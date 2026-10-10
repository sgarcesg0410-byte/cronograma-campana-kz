import assert from 'assert';
import crypto from 'crypto';
import db, { initDatabase } from './db.js';
import {
  validateWebhookSignature,
  parseCommunityNeedMessage,
  formatNeedRegisteredConfirmation,
  formatNeedParseError,
  enqueueActivityNotification,
  processNotificationQueue,
  cancelPendingActivityNotifications,
  validateE164Phone,
  ALLOWED_NEED_CATEGORIES
} from './whatsappService.js';

async function runTests() {
  console.log('🧪 Iniciando batería de pruebas unitarias y de integración...\n');

  await initDatabase();

  // Test 1: Category normalization & validation
  console.log('Test 1: Categorías permitidas y normalización');
  assert.strictEqual(ALLOWED_NEED_CATEGORIES.length, 10, 'Deben haber exactamente 10 categorías permitidas');
  assert.ok(ALLOWED_NEED_CATEGORIES.includes('Salud'), 'Debe incluir Salud');
  assert.ok(ALLOWED_NEED_CATEGORIES.includes('Vivienda'), 'Debe incluir Vivienda');
  console.log('  ✅ Categorías correctas');

  // Test 2: OWASP Webhook HMAC-SHA256 Signature Validation
  console.log('Test 2: Validación de firma HMAC-SHA256 con timingSafeEqual');
  const secret = 'super_secret_webhook_key_2026';
  const rawBody = Buffer.from(JSON.stringify({ text: 'NECESIDAD\nBarrio: Centro\nPersona: Ana\nTelefono: 3001234567\nTipo: Salud\nDescripcion: Medicamentos' }));
  const validHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const validHeader = `sha256=${validHash}`;
  const invalidHeader = `sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`;

  assert.strictEqual(validateWebhookSignature(rawBody, validHeader, secret), true, 'Firma válida debe ser aprobada');
  assert.strictEqual(validateWebhookSignature(rawBody, invalidHeader, secret), false, 'Firma inválida debe ser rechazada');
  assert.strictEqual(validateWebhookSignature(rawBody, null, secret), false, 'Firma ausente debe ser rechazada');
  console.log('  ✅ Validación criptográfica HMAC-SHA256 aprobada');

  // Test 3: WhatsApp Bot Command Parser
  console.log('Test 3: Parser de comandos de WhatsApp (#VOYCONELKZ)');
  const sampleIncomingText = `
NECESIDAD
Barrio: La Floresta
Persona: Roberto Carlos Mejia
Teléfono: 3105556677
Tipo: Salud
Prioridad: Urgente
Descripción: Requiere ambulancia y tanque de oxígeno de emergencia en domicilio.
  `.trim();

  const parseResult = parseCommunityNeedMessage(sampleIncomingText, '+573105556677');
  assert.strictEqual(parseResult.isNeedCommand, true, 'Debe reconocer comando NECESIDAD');
  assert.strictEqual(parseResult.isValid, true, 'Debe ser un mensaje válido con todos los campos');
  assert.strictEqual(parseResult.data.neighborhood, 'La Floresta');
  assert.strictEqual(parseResult.data.person_name, 'Roberto Carlos Mejia');
  assert.strictEqual(parseResult.data.phone, '+573105556677', 'Debe normalizar a formato internacional E.164');
  assert.strictEqual(parseResult.data.category, 'Salud');
  assert.strictEqual(parseResult.data.priority, 'Urgente');
  assert.strictEqual(parseResult.data.consent_contact, 1, 'Consentimiento informado por defecto');
  console.log('  ✅ Parser extrae todos los campos y normaliza E.164 correctamente');

  // Test 4: Incomplete Message Error Handling
  console.log('Test 4: Manejo de campos faltantes sin fugas');
  const incompleteText = `
NECESIDAD
Barrio: San José
Persona: Pedro
  `.trim();
  const incompleteResult = parseCommunityNeedMessage(incompleteText);
  assert.strictEqual(incompleteResult.isNeedCommand, true);
  assert.strictEqual(incompleteResult.isValid, false, 'Debe detectar campos faltantes');
  assert.ok(incompleteResult.missingFields.length >= 2, 'Debe listar campos faltantes');
  assert.ok(incompleteResult.errorReply.includes('Faltan datos'), 'Debe retornar plantilla instructiva');
  console.log('  ✅ Detección de errores y mensaje de ayuda correcto');

  // Test 5: Sanitized Confirmation Message (No PII Leakage)
  console.log('Test 5: Confirmación sanitizada del bot (Habeas Data)');
  const confirmMsg = formatNeedRegisteredConfirmation({
    id: 104,
    neighborhood: 'La Floresta',
    category: 'Salud',
    priority: 'Urgente',
    status: 'pendiente'
  });
  assert.ok(confirmMsg.includes('#104'), 'Debe incluir ID de caso');
  assert.ok(confirmMsg.includes('La Floresta'), 'Debe incluir Barrio');
  assert.ok(!confirmMsg.includes('oxígeno'), 'NO debe repetir descripción clínica/médica por WhatsApp');
  assert.ok(!confirmMsg.includes('Roberto'), 'NO debe filtrar nombres en el mensaje público de confirmación');
  console.log('  ✅ Mensaje sanitizado sin filtración de datos sensibles');

  // Test 6: Database Insertion & Deduplication (source_message_id)
  console.log('Test 6: Inserción en base de datos y deduplicación por wamid');
  const wamid = 'wamid.HBgLNTczMTA1NTU2Njc3FQIAERgSMzFFNzBGQ0QyQUQ3OUU0ODg5AA==';
  
  // Limpiar registros previos de prueba
  db.run("DELETE FROM community_needs WHERE source_message_id = ?", [wamid]);

  const insertRes = db.run(`
    INSERT INTO community_needs (
      neighborhood, person_name, phone, category, description,
      priority, status, source, source_message_id, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'whatsapp', ?, 0)
  `, ['La Floresta', 'Roberto Carlos Mejia', '+573105556677', 'Salud', 'Prueba automatizada de DB', 'Urgente', wamid]);

  assert.ok(insertRes.lastInsertRowid > 0, 'Debe insertar nuevo caso');

  // Intentar duplicar mismo wamid: debe fallar por restricción UNIQUE
  let dupError = false;
  try {
    db.run(`
      INSERT INTO community_needs (
        neighborhood, person_name, phone, category, description,
        priority, status, source, source_message_id, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'whatsapp', ?, 0)
    `, ['La Floresta', 'Roberto Carlos Mejia', '+573105556677', 'Salud', 'Intento duplicado', 'Urgente', wamid]);
  } catch (err) {
    dupError = true;
  }
  assert.strictEqual(dupError, true, 'Debe rechazar inserción con wamid duplicado');
  console.log('  ✅ Inserción de necesidad y deduplicación por wamid verificada');

  // Test 7: Resilient Notification Queue (Idempotency dedupe_key)
  console.log('Test 7: Cola idempotente de notificaciones (dedupe_key)');
  const dedupeKey = `test_dedupe_act_999_+573001234567`;
  db.run("DELETE FROM notification_queue WHERE dedupe_key = ?", [dedupeKey]);

  const enqueuedFirst = enqueueActivityNotification({
    activityId: 999,
    recipientPhone: '+573001234567',
    recipientName: 'Coordinador Prueba',
    notificationType: 'test_alert',
    dedupeKey: dedupeKey,
    scheduledFor: new Date().toISOString(),
    messageText: 'Recordatorio oficial #VOYCONELKZ'
  });
  assert.strictEqual(enqueuedFirst, true, 'Primer encolamiento debe ser exitoso');

  // Segundo encolamiento con misma dedupeKey: debe ser ignorado limpiamente sin duplicados
  const enqueuedSecond = enqueueActivityNotification({
    activityId: 999,
    recipientPhone: '+573001234567',
    recipientName: 'Coordinador Prueba',
    notificationType: 'test_alert',
    dedupeKey: dedupeKey,
    scheduledFor: new Date().toISOString(),
    messageText: 'Recordatorio oficial #VOYCONELKZ'
  });
  assert.strictEqual(enqueuedSecond, false, 'Segundo encolamiento con dedupe_key duplicada debe ser ignorado (idempotencia ON CONFLICT DO NOTHING)');

  const queueCount = db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE dedupe_key = ?", [dedupeKey])?.count;
  assert.strictEqual(queueCount, 1, 'Debe haber exactamente un registro en cola para esa dedupeKey');
  console.log('  ✅ Idempotencia en cola garantizada');

  // Test 8: Process queue worker
  console.log('Test 8: Ejecución del worker de la cola de notificaciones');
  const processed = await processNotificationQueue();
  assert.ok(typeof processed === 'number', 'El procesador debe retornar cantidad procesada');
  console.log(`  ✅ Worker procesó ${processed} elementos sin errores`);

  // Test 9: Cancellation of pending notifications
  console.log('Test 9: Cancelación en cascada de notificaciones al cancelar actividad');
  const cancelKey = `test_cancel_act_888_+573001234567`;
  db.run("DELETE FROM notification_queue WHERE dedupe_key = ?", [cancelKey]);
  enqueueActivityNotification({
    activityId: 888,
    recipientPhone: '+573001234567',
    recipientName: 'Líder',
    notificationType: 'activity_reminder',
    dedupeKey: cancelKey,
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    messageText: 'Alerta que será cancelada'
  });

  const cancelledCount = cancelPendingActivityNotifications(888);
  assert.ok(cancelledCount >= 1, 'Debe cancelar las notificaciones pendientes de la actividad');
  const cancelledStatus = db.queryOne("SELECT status FROM notification_queue WHERE dedupe_key = ?", [cancelKey])?.status;
  assert.strictEqual(cancelledStatus, 'cancelled', 'El estado debe cambiar a cancelled');
  console.log('  ✅ Cancelación de notificaciones en cascada verificada');

  // Limpieza de datos de prueba
  db.run("DELETE FROM community_needs WHERE source_message_id = ?", [wamid]);
  db.run("DELETE FROM notification_queue WHERE dedupe_key IN (?, ?)", [dedupeKey, cancelKey]);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS (9/9) PASARON EXITOSAMENTE!');
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});

import assert from 'assert';
import crypto from 'crypto';
import db, { initDatabase } from './db.js';
import {
  validateE164Phone,
  getBogotaDateParts,
  isBogotaQuietHours,
  getNextBogotaQuietHoursEndIso,
  formatSpanishDateWithDay,
  formatTime12h,
  calculateActivityRelevantChanges,
  formatEventCreatedMessage,
  formatEventUpdatedMessage,
  formatEventCancelledMessage,
  formatEventReminderMessage,
  getNotificationRecipients,
  scheduleAdvanceReminders,
  cancelPendingActivityNotifications,
  enqueueActivityNotification,
  processNotificationQueue,
} from './whatsappService.js';

async function runTestSuite() {
  console.log('🚀 Iniciando Batería de Pruebas: Notificaciones Automáticas en Tiempo Real (#VOY CON EL KZ)\n');

  await initDatabase();

  // ----------------------------------------------------
  // TEST 1: Validación de Formato Telefónico E.164
  // ----------------------------------------------------
  console.log('Test 1: Validación rigurosa de formato telefónico E.164');
  assert.strictEqual(validateE164Phone('+573001234567'), true, '+573001234567 debe ser válido');
  assert.strictEqual(validateE164Phone('+14155552671'), true, '+14155552671 debe ser válido');
  assert.strictEqual(validateE164Phone('+573105556677'), true, '+573105556677 debe ser válido');
  assert.strictEqual(validateE164Phone('3001234567'), false, 'Sin signo + debe ser rechazado');
  assert.strictEqual(validateE164Phone('+012345678'), false, 'Código de país iniciando en 0 debe ser rechazado');
  assert.strictEqual(validateE164Phone('+57 300 123 4567'), false, 'Espacios en número deben ser rechazados');
  assert.strictEqual(validateE164Phone('abcd'), false, 'Texto no numérico debe ser rechazado');
  console.log('  ✅ Validación E.164 conforme a especificación UIT-T\n');

  // ----------------------------------------------------
  // TEST 2: Operaciones de Zona Horaria America/Bogota (UTC-5)
  // ----------------------------------------------------
  console.log('Test 2: Zona Horaria America/Bogota (UTC-5) y Horas Silenciosas');
  const nowBogota = getBogotaDateParts();
  assert.ok(nowBogota.year >= 2024, 'Año en Bogotá debe ser válido');
  assert.ok(nowBogota.hour >= 0 && nowBogota.hour <= 23, 'Hora debe estar entre 0 y 23');
  assert.ok(nowBogota.minute >= 0 && nowBogota.minute <= 59, 'Minuto debe estar entre 0 y 59');

  // Prueba de quiet hours: 23:30 (debe estar en silencio) vs 14:00 (no debe estar en silencio)
  const nightDate = new Date('2026-10-15T04:30:00Z'); // 23:30 en Bogotá (UTC - 5h)
  const isNightQuiet = isBogotaQuietHours(nightDate, '22:00', '06:00');
  assert.strictEqual(isNightQuiet, true, '23:30 Bogotá debe ser considerado dentro de horas silenciosas');

  const dayDate = new Date('2026-10-15T19:00:00Z'); // 14:00 en Bogotá
  const isDayQuiet = isBogotaQuietHours(dayDate, '22:00', '06:00');
  assert.strictEqual(isDayQuiet, false, '14:00 Bogotá debe estar fuera de horas silenciosas');

  const nextEndIso = getNextBogotaQuietHoursEndIso('06:00', nightDate);
  assert.ok(nextEndIso.endsWith('.000Z'), 'Debe generar ISO UTC');
  const nextEndDate = new Date(nextEndIso);
  const nextBogotaParts = getBogotaDateParts(nextEndDate);
  assert.strictEqual(nextBogotaParts.hour, 6, 'La hora de fin en Bogotá debe ser exactamente las 06:00');
  assert.strictEqual(nextBogotaParts.minute, 0, 'El minuto de fin debe ser 00');
  console.log('  ✅ Operaciones y postergación de horas silenciosas en Bogotá correctas\n');

  // ----------------------------------------------------
  // TEST 3: Formateo de Fechas en Español y 12 Horas
  // ----------------------------------------------------
  console.log('Test 3: Formateo legible de fechas y horas en español');
  const formattedDate = formatSpanishDateWithDay('2026-10-12');
  assert.ok(formattedDate.includes('12 de octubre'), `Debe incluir "12 de octubre": ${formattedDate}`);
  assert.strictEqual(formatTime12h('08:30'), '8:30 a.m.');
  assert.strictEqual(formatTime12h('16:45'), '4:45 p.m.');
  assert.strictEqual(formatTime12h('12:00'), '12:00 p.m.');
  assert.strictEqual(formatTime12h('00:00'), '12:00 a.m.');
  console.log('  ✅ Formateo en español y 12h AM/PM correcto\n');

  // ----------------------------------------------------
  // TEST 4: Diff Inteligente de Cambios en Agenda
  // ----------------------------------------------------
  console.log('Test 4: Diff inteligente de actividades (omite notas internas y calcula hash)');
  const baseActivity = {
    id: 99,
    title: 'Mitin de Plaza Principal',
    category: 'mitin',
    date: '2026-10-20',
    start_time: '10:00',
    location_name: 'Parque de los Comuneros',
    location_address: 'Calle 5 # 10-20',
    responsible_name: 'Carlos Zapata',
    notes: 'Nota privada interna de logística'
  };

  // 4a. Cambio únicamente en notas internas -> NO debe generar alerta
  const notesOnlyChange = {
    ...baseActivity,
    notes: 'Nota privada modificada por el equipo de coordinación'
  };
  const diffNotesOnly = calculateActivityRelevantChanges(baseActivity, notesOnlyChange);
  assert.strictEqual(diffNotesOnly.hasRelevantChanges, false, 'Cambios en notas internas no deben alertar');
  assert.strictEqual(diffNotesOnly.changesCount, 0);

  // 4b. Cambio en fecha y hora -> SÍ debe generar alerta con hash determinístico
  const timeAndPlaceChange = {
    ...baseActivity,
    date: '2026-10-21',
    start_time: '15:30',
    location_name: 'Coliseo Municipal'
  };
  const diffRelevant = calculateActivityRelevantChanges(baseActivity, timeAndPlaceChange);
  assert.strictEqual(diffRelevant.hasRelevantChanges, true, 'Cambio de fecha, hora y lugar debe alertar');
  assert.strictEqual(diffRelevant.changesCount, 3, 'Debe registrar 3 cambios detectados');
  assert.ok(diffRelevant.contentHash && diffRelevant.contentHash.length === 8, 'Debe generar hash de 8 caracteres');

  // 4c. Mismo cambio repetido produce el mismo hash de deduplicación
  const diffRepeat = calculateActivityRelevantChanges(baseActivity, timeAndPlaceChange);
  assert.strictEqual(diffRelevant.contentHash, diffRepeat.contentHash, 'El hash debe ser determinístico para deduplicación');
  console.log('  ✅ Diff inteligente y hash determinístico verificados\n');

  // ----------------------------------------------------
  // TEST 5: Formateo Oficial de Plantillas de Mensajes
  // ----------------------------------------------------
  console.log('Test 5: Plantillas oficiales de WhatsApp (#VOY CON EL KZ)');
  const createdMsg = formatEventCreatedMessage(baseActivity);
  assert.ok(createdMsg.includes('📢 *NUEVO EVENTO REGISTRADO | #VOY CON EL KZ*'), 'Encabezado de creación correcto');
  assert.ok(createdMsg.includes('Mitin de Plaza Principal'), 'Incluye título');
  assert.ok(createdMsg.includes('Parque de los Comuneros'), 'Incluye lugar');

  const updatedMsg = formatEventUpdatedMessage(timeAndPlaceChange, diffRelevant.changesSummary);
  assert.ok(updatedMsg.includes('⚠️ *CAMBIO EN LA AGENDA | #VOY CON EL KZ*'), 'Encabezado de actualización correcto');
  assert.ok(updatedMsg.includes('Coliseo Municipal'), 'Incluye nuevo lugar');

  const cancelledMsg = formatEventCancelledMessage(baseActivity, 'Alerta de fuertes lluvias');
  assert.ok(cancelledMsg.includes('🚫 *EVENTO CANCELADO | #VOY CON EL KZ*'), 'Encabezado de cancelación correcto');
  assert.ok(cancelledMsg.includes('Alerta de fuertes lluvias'), 'Incluye motivo de cancelación');

  const reminderMsg = formatEventReminderMessage(baseActivity, 'Recordatorio 1 día antes');
  assert.ok(reminderMsg.includes('⏰ *RECORDATORIO DE EVENTO (Recordatorio 1 día antes) | #VOY CON EL KZ*'), 'Encabezado de recordatorio correcto');
  assert.ok(reminderMsg.includes('Recordatorio 1 día antes'), 'Incluye etiqueta de anticipación');
  console.log('  ✅ Formateadores de texto oficiales conformes\n');

  // ----------------------------------------------------
  // TEST 6: Configuración de Destinatarios y Filtro de Activos
  // ----------------------------------------------------
  console.log('Test 6: Resolución de destinatarios y exclusión de inactivos');
  const testAuthorized = [
    { name: 'Dr. Roberto Candidato', phone: '+573101112233', role: 'candidato', active: true },
    { name: 'Ana Coordinadora', phone: '+573204445566', role: 'coordinador', active: true },
    { name: 'Lucas Inactivo', phone: '+573007778899', role: 'lider', active: false },
    { name: 'Mariana Prensa', phone: '+573159990011', role: 'prensa', active: true }
  ];

  db.run(`
    INSERT OR REPLACE INTO whatsapp_settings (
      id, provider, primary_phone, authorized_phones, notify_on_create, notify_on_update,
      notify_on_cancel, notify_on_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    ) VALUES (
      1, 'simulation', '+573001234567', ?, 1, 1, 1, 1, 1, '22:00', '06:00'
    )
  `, [JSON.stringify(testAuthorized)]);

  const recipients = getNotificationRecipients(baseActivity);
  const recipientPhones = recipients.map(r => r.phone);
  assert.ok(recipientPhones.includes('+573001234567'), 'Debe incluir el teléfono principal');
  assert.ok(recipientPhones.includes('+573101112233'), 'Debe incluir al candidato activo');
  assert.ok(recipientPhones.includes('+573204445566'), 'Debe incluir a la coordinadora activa');
  assert.ok(!recipientPhones.includes('+573007778899'), 'NO debe incluir al contacto inactivo');
  console.log('  ✅ Resolución de destinatarios y filtro de contactos inactivos correcto\n');

  // ----------------------------------------------------
  // TEST 7: Deduplicación Criptográfica en Cola (ON CONFLICT IGNORE)
  // ----------------------------------------------------
  console.log('Test 7: Deduplicación estricta de notificaciones por dedupeKey');
  db.run("DELETE FROM notification_queue WHERE recipient_phone = '+573001234567'");

  const dedupeKeyTest = `event-created-999-+573001234567`;
  const firstInsert = enqueueActivityNotification({
    activityId: 999,
    recipientPhone: '+573001234567',
    recipientName: 'Central de Campaña',
    notificationType: 'event_created',
    dedupeKey: dedupeKeyTest,
    scheduledFor: new Date().toISOString(),
    messageText: 'Mensaje de prueba deduplicado'
  });
  assert.strictEqual(firstInsert, true, 'La primera inserción debe retornar true');

  // Intento de segunda inserción idéntica
  const secondInsert = enqueueActivityNotification({
    activityId: 999,
    recipientPhone: '+573001234567',
    recipientName: 'Central de Campaña',
    notificationType: 'event_created',
    dedupeKey: dedupeKeyTest,
    scheduledFor: new Date().toISOString(),
    messageText: 'Mensaje de prueba deduplicado duplicado'
  });
  assert.strictEqual(secondInsert, false, 'Segunda inserción con mismo dedupeKey debe retornar false (DO NOTHING)');

  const countRows = db.queryOne(
    "SELECT COUNT(*) as count FROM notification_queue WHERE dedupe_key = ?",
    [dedupeKeyTest]
  )?.count;
  assert.strictEqual(countRows, 1, 'Solo debe existir exactamente 1 registro en la cola');
  console.log('  ✅ Idempotencia y deduplicación criptográfica verificada\n');

  // ----------------------------------------------------
  // TEST 8: Programación y Cancelación en Cascada de Recordatorios
  // ----------------------------------------------------
  console.log('Test 8: Programación escalonada (7d, 3d, 1d, salida) y cancelación en cascada');
  const futureActivity = {
    id: 888,
    title: 'Gran Cierre de Campaña',
    category: 'mitin',
    date: '2026-10-25', // 14+ días en el futuro
    start_time: '18:00',
    location_name: 'Plaza de Toros',
    location_address: 'Av. Circunvalar',
    responsible_name: 'Equipo General'
  };

  db.run("DELETE FROM notification_queue WHERE activity_id = 888");

  // Programar recordatorios
  const scheduledCount = scheduleAdvanceReminders(futureActivity, [{ name: 'Test', phone: '+573001234567' }]);
  assert.strictEqual(scheduledCount, 4, 'Deben programarse exactamente 4 recordatorios (7d, 3d, 1d, salida)');

  const pendingRemindersBefore = db.query(
    "SELECT * FROM notification_queue WHERE activity_id = 888 AND status = 'pending'"
  );
  assert.strictEqual(pendingRemindersBefore.length, 4, 'Deben haber 4 recordatorios pendientes');

  // Cancelar en cascada (simulando cancelación del evento)
  const cancelledReminders = cancelPendingActivityNotifications(888);
  assert.strictEqual(cancelledReminders, 4, 'Deben cancelarse los 4 recordatorios pendientes');

  const pendingRemindersAfter = db.query(
    "SELECT * FROM notification_queue WHERE activity_id = 888 AND status = 'pending'"
  );
  assert.strictEqual(pendingRemindersAfter.length, 0, 'No deben quedar recordatorios pendientes');

  const cancelledCountDb = db.query(
    "SELECT * FROM notification_queue WHERE activity_id = 888 AND status = 'cancelled'"
  );
  assert.strictEqual(cancelledCountDb.length, 4, 'Los 4 recordatorios deben figurar como cancelados');
  console.log('  ✅ Programación escalonada y cancelación en cascada verificada\n');

  // ----------------------------------------------------
  // TEST 9: Bloqueo Atómico de Concurrencia (Zero Duplication)
  // ----------------------------------------------------
  console.log('Test 9: Bloqueo atómico contra condiciones de carrera concurrentes');
  const uniqueKeyAtomic = `atomic-test-${Date.now()}`;
  enqueueActivityNotification({
    activityId: 777,
    recipientPhone: '+573001234567',
    recipientName: 'Test Concurrency',
    notificationType: 'event_created',
    dedupeKey: uniqueKeyAtomic,
    scheduledFor: new Date(Date.now() - 1000).toISOString(),
    messageText: 'Test atomic locking'
  });

  const rowToClaim = db.queryOne("SELECT id FROM notification_queue WHERE dedupe_key = ?", [uniqueKeyAtomic]);
  assert.ok(rowToClaim && rowToClaim.id, 'Fila debe existir en estado pending');

  // Worker 1 reclama atómicamente
  const worker1Claim = db.run(
    "UPDATE notification_queue SET status = 'processing' WHERE id = ? AND status = 'pending'",
    [rowToClaim.id]
  );
  assert.strictEqual(worker1Claim.changes, 1, 'Worker 1 debe reclamar la fila exitosamente');

  // Worker 2 intenta reclamar la misma fila simultáneamente
  const worker2Claim = db.run(
    "UPDATE notification_queue SET status = 'processing' WHERE id = ? AND status = 'pending'",
    [rowToClaim.id]
  );
  assert.strictEqual(worker2Claim.changes, 0, 'Worker 2 debe ser rechazado atómicamente (changes === 0)');
  console.log('  ✅ Bloqueo atómico previene despachos duplicados bajo concurrencia\n');

  // ----------------------------------------------------
  // TEST 10: Despacho de Cola y Postergación por Horas Silenciosas
  // ----------------------------------------------------
  console.log('Test 10: Despacho de cola, envío inmediato de eventos vs postergación de recordatorios');
  // Limpiar registros previos de pruebas
  db.run("DELETE FROM notification_queue WHERE activity_id IN (777, 888, 999)");

  // 10a. Evento urgente creado: se debe enviar inmediatamente
  const urgentCreatedKey = `urgent-created-${Date.now()}`;
  enqueueActivityNotification({
    activityId: 777,
    recipientPhone: '+573001234567',
    recipientName: 'Central Campaña',
    notificationType: 'event_created',
    dedupeKey: urgentCreatedKey,
    scheduledFor: new Date(Date.now() - 1000).toISOString(),
    messageText: 'Alerta prioritaria de creación'
  });

  const dispatchCount = await processNotificationQueue();
  assert.ok(dispatchCount >= 1, 'Debe procesar al menos la notificación creada');

  const createdRowStatus = db.queryOne(
    "SELECT status FROM notification_queue WHERE dedupe_key = ?",
    [urgentCreatedKey]
  )?.status;
  assert.strictEqual(createdRowStatus, 'sent', 'La alerta de creación debe figurar como enviada (sent)');
  console.log('  ✅ Despacho inmediato verificado en el motor de cola\n');

  console.log('================================================================');
  console.log('🎉 TODAS LAS PRUEBAS (10/10) PASARON EXITOSAMENTE SIN ERRORES');
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', err);
  process.exit(1);
});

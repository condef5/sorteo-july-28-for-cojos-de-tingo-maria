#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface WhatsAppMessage {
  timestamp: string;
  sender: string;
  content: string;
  rawMessage: string;
}

interface FilteredEvent {
  eventName: string;
  eventDate: string; // Fecha extraída del timestamp (dd/mm/yy)
  dayOfWeek: string;
  time: string;
  location: string;
  players: string[];
  totalPlayers: number;
  messageTimestamp: string;
  sender: string;
  originalMessage: WhatsAppMessage;
}

class MessageFilter {
  private allowedDays = [
    'viernes',
    'vienes', // viernes y su typo común
    'miércoles',
    'miercoles', // miércoles con y sin tilde
    'miercoles',
    'miércoles', // asegurar ambas variantes
  ];

  private parseTimestamp(timestamp: string): Date {
    try {
      // Limpiar el timestamp de caracteres especiales
      const cleanTimestamp = timestamp.replace(/[‎]/g, '').trim();

      // Intentar diferentes formatos de timestamp
      const formats = [
        // Formato principal: "25/07/25, 12:13:12 p. m."
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2})\s*([ap]\.?\s*m\.?)$/i,
        // Formato alternativo: "25/07/25, 12:13 p. m."
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*([ap]\.?\s*m\.?)$/i,
        // Formato sin AM/PM: "25/07/25, 12:13:12"
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2})$/,
        // Formato solo fecha: "25/07/25"
        /^(\d{1,2}\/\d{1,2}\/\d{2,4})$/,
      ];

      for (const format of formats) {
        const match = cleanTimestamp.match(format);
        if (match) {
          const [, datePart, timePart, period] = match;
          const [day, month, year] = datePart.split('/').map(Number);

          let hours = 0,
            minutes = 0,
            seconds = 0;

          if (timePart) {
            const timeComponents = timePart.split(':').map(Number);
            hours = timeComponents[0] || 0;
            minutes = timeComponents[1] || 0;
            seconds = timeComponents[2] || 0;

            // Ajustar para AM/PM si está presente
            if (period) {
              const isPM = period.toLowerCase().includes('p');
              const isAM = period.toLowerCase().includes('a');

              if (isPM && hours !== 12) {
                hours += 12;
              } else if (isAM && hours === 12) {
                hours = 0;
              }
            }
          }

          // Asumir que años de 2 dígitos son 20xx
          const fullYear = year < 100 ? 2000 + year : year;

          return new Date(fullYear, month - 1, day, hours, minutes, seconds);
        }
      }

      // Si no coincide con ningún formato, usar fecha actual como fallback
      console.warn(`⚠️  Formato de timestamp no reconocido: "${timestamp}"`);
      return new Date();
    } catch (error) {
      console.warn(`⚠️  Error parseando timestamp "${timestamp}":`, error);
      return new Date();
    }
  }

  private extractDateFromTimestamp(timestamp: string): string {
    try {
      // Limpiar el timestamp de caracteres especiales
      const cleanTimestamp = timestamp.replace(/[‎]/g, '').trim();

      // Extraer solo la parte de fecha del timestamp
      const datePart = cleanTimestamp.split(',')[0].trim();
      return datePart;
    } catch (error) {
      console.warn(`⚠️  Error extrayendo fecha de "${timestamp}":`, error);
      return timestamp;
    }
  }

  private normalizeDayName(day: string): string {
    const normalized = day.toLowerCase().trim();

    // Mapear variantes comunes a la forma correcta
    const dayMappings: { [key: string]: string } = {
      vienes: 'viernes',
      viernes: 'viernes',
      miercoles: 'miércoles',
      miércoles: 'miércoles',
    };

    return dayMappings[normalized] || normalized;
  }

  private isAllowedDay(day: string): boolean {
    const normalized = day.toLowerCase().trim();
    return this.allowedDays.some(
      (allowedDay) => allowedDay.toLowerCase() === normalized
    );
  }

  private parseEventFromMessage(
    message: WhatsAppMessage
  ): FilteredEvent | null {
    try {
      const lines = message.content.split('\n');
      let eventName = '';
      let dayOfWeek = '';
      let time = '';
      let location = '';
      const players: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) continue;

        // Extraer información del evento
        if (
          trimmedLine.toLowerCase().includes('pichanga') ||
          trimmedLine.toLowerCase().includes('ipi')
        ) {
          eventName = trimmedLine;
        } else if (trimmedLine.toLowerCase().startsWith('día:')) {
          dayOfWeek = trimmedLine.replace(/día:/i, '').trim();
        } else if (trimmedLine.toLowerCase().startsWith('hora:')) {
          time = trimmedLine.replace(/hora:/i, '').trim();
        } else if (trimmedLine.toLowerCase().startsWith('lugar:')) {
          location = trimmedLine.replace(/lugar:/i, '').trim();
        } else if (/^\d+\.\s*/.test(trimmedLine)) {
          // Extraer jugadores (formato: "1. - Alex" o "2. Moises(4)")
          const playerMatch = trimmedLine.match(/^\d+\.\s*-?\s*(.+)/);
          if (playerMatch) {
            let playerName = playerMatch[1].trim();
            // Limpiar texto como "<Se editó este mensaje.>"
            playerName = playerName.replace(/‎<[^>]+>/, '').trim();

            if (playerName && playerName !== '-') {
              players.push(playerName);
            }
          }
        }
      }

      // Solo procesar si es un día permitido
      if (!this.isAllowedDay(dayOfWeek)) {
        return null;
      }

      return {
        eventName,
        eventDate: this.extractDateFromTimestamp(message.timestamp),
        dayOfWeek: this.normalizeDayName(dayOfWeek),
        time,
        location,
        players,
        totalPlayers: players.length,
        messageTimestamp: message.timestamp,
        sender: message.sender,
        originalMessage: message,
      };
    } catch (error) {
      console.error('Error parseando evento:', error);
      return null;
    }
  }

  private removeDuplicates(events: FilteredEvent[]): FilteredEvent[] {
    const eventMap = new Map<string, FilteredEvent>();

    for (const event of events) {
      try {
        // Crear clave única basada en día y fecha
        const key = `${event.dayOfWeek}_${event.eventDate}`;
        const existingEvent = eventMap.get(key);

        if (!existingEvent) {
          eventMap.set(key, event);
        } else {
          // Comparar timestamps para quedarse con el más reciente
          const currentTime = this.parseTimestamp(event.messageTimestamp);
          const existingTime = this.parseTimestamp(
            existingEvent.messageTimestamp
          );

          if (currentTime > existingTime) {
            eventMap.set(key, event);
            console.log(`🔄 Reemplazando evento duplicado: ${key}`);
            console.log(
              `   Anterior: ${existingEvent.sender} - ${existingEvent.messageTimestamp}`
            );
            console.log(
              `   Nuevo: ${event.sender} - ${event.messageTimestamp}`
            );
          }
        }
      } catch (error) {
        console.warn(`⚠️  Error procesando evento duplicado:`, error);
        // En caso de error, mantener el evento actual
        const key = `${event.dayOfWeek}_${event.eventDate}_${Date.now()}`;
        eventMap.set(key, event);
      }
    }

    return Array.from(eventMap.values());
  }

  processMessages(filePath: string): FilteredEvent[] {
    try {
      console.log(`📖 Leyendo archivo: ${filePath}`);
      const jsonContent = readFileSync(filePath, 'utf-8');
      const messages: WhatsAppMessage[] = JSON.parse(jsonContent);

      console.log(`📊 Total de mensajes cargados: ${messages.length}`);

      // Filtrar y parsear eventos
      const events: FilteredEvent[] = [];

      for (const message of messages) {
        const event = this.parseEventFromMessage(message);
        if (event) {
          events.push(event);
        }
      }

      console.log(`⚽ Eventos de pichanga encontrados: ${events.length}`);

      // Remover duplicados
      const uniqueEvents = this.removeDuplicates(events);
      console.log(
        `✨ Eventos únicos después de filtrar: ${uniqueEvents.length}`
      );

      // Ordenar por fecha (con manejo de errores)
      uniqueEvents.sort((a, b) => {
        try {
          const dateA = this.parseTimestamp(a.messageTimestamp);
          const dateB = this.parseTimestamp(b.messageTimestamp);
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.warn('⚠️  Error ordenando eventos por fecha:', error);
          return 0; // Mantener orden original si hay error
        }
      });

      return uniqueEvents;
    } catch (error) {
      console.error('❌ Error procesando mensajes:', error);
      return [];
    }
  }

  exportResults(events: FilteredEvent[], outputPath: string): void {
    try {
      const output = {
        metadata: {
          totalEvents: events.length,
          generatedAt: new Date().toISOString(),
          allowedDays: ['viernes', 'miércoles'],
          description:
            'Eventos de pichanga filtrados para viernes y miércoles, sin duplicados',
        },
        events: events,
      };

      writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`✅ Resultados exportados a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando resultados:', error);
    }
  }

  printSummary(events: FilteredEvent[]): void {
    console.log('\n📋 RESUMEN DE EVENTOS:');
    console.log('='.repeat(50));

    events.forEach((event, index) => {
      console.log(`\n🏆 Evento ${index + 1}:`);
      console.log(`   📅 ${event.eventName}`);
      console.log(`   📆 Fecha: ${event.eventDate} (${event.dayOfWeek})`);
      console.log(`   🕐 Hora: ${event.time}`);
      console.log(`   📍 Lugar: ${event.location}`);
      console.log(`   👥 Jugadores (${event.totalPlayers}):`);

      event.players.forEach((player, i) => {
        console.log(`      ${i + 1}. ${player}`);
      });

      console.log(
        `   📱 Último mensaje: ${event.sender} - ${event.messageTimestamp}`
      );
    });

    // Estadísticas adicionales
    const byDay = events.reduce((acc, event) => {
      acc[event.dayOfWeek] = (acc[event.dayOfWeek] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 ESTADÍSTICAS:');
    console.log(`   Total de eventos únicos: ${events.length}`);
    Object.entries(byDay).forEach(([day, count]) => {
      console.log(`   ${day}: ${count} eventos`);
    });

    const avgPlayers =
      events.length > 0
        ? (
            events.reduce((sum, e) => sum + e.totalPlayers, 0) / events.length
          ).toFixed(1)
        : 0;
    console.log(`   Promedio de jugadores por evento: ${avgPlayers}`);
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Uso: bun run 2-filter-messages-per-day.ts <archivo-mensajes.json>');
    console.log('📝 Ejemplo: bun run 2-filter-messages-per-day.ts output/first/messages.json');
    process.exit(1);
  }

  const inputPath = resolve(args[0]);
  const outputPath = resolve('output/second/filter-events.json');

  const filter = new MessageFilter();

  // Procesar mensajes
  const events = filter.processMessages(inputPath);

  if (events.length === 0) {
    console.log(
      '❌ No se encontraron eventos válidos para los días especificados'
    );
    return;
  }

  // Mostrar resumen
  filter.printSummary(events);

  // Exportar resultados
  filter.exportResults(events, outputPath);

  console.log('\n✅ Proceso completado exitosamente!');
}

main().catch(console.error);

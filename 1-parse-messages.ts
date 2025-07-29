#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface WhatsAppMessage {
  timestamp: string;
  sender: string;
  content: string;
  rawMessage: string;
}

interface PlayerList {
  eventName: string;
  date: string;
  time: string;
  location: string;
  players: string[];
  messageTimestamp: string;
  sender: string;
}

class WhatsAppParser {
  private messages: WhatsAppMessage[] = [];

  // Patrón regex para detectar el inicio de un mensaje
  private messagePattern =
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2}\s*[ap]\.\s*m\.)\]\s*([^:]+):\s*(.*)/;

  // Patrón para mensajes del sistema (ej: "Video omitido")
  private systemPattern =
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2}\s*[ap]\.\s*m\.)\]\s*([^:]*?):\s*‎(.*)$/;

  parseFile(filePath: string): WhatsAppMessage[] {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let currentMessage: WhatsAppMessage | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) continue;

        // Verificar si es el inicio de un nuevo mensaje
        const messageMatch =
          line.match(this.messagePattern) || line.match(this.systemPattern);

        if (messageMatch) {
          // Si hay un mensaje previo, guardarlo
          if (currentMessage) {
            this.messages.push(currentMessage);
          }

          // Crear nuevo mensaje
          const [, date, time, sender, content] = messageMatch;
          currentMessage = {
            timestamp: `${date}, ${time}`,
            sender: sender.trim(),
            content: content || '',
            rawMessage: line,
          };
        } else if (currentMessage) {
          // Continuar el mensaje anterior (mensaje multilínea)
          currentMessage.content += '\n' + line;
          currentMessage.rawMessage += '\n' + line;
        }
      }

      // Agregar el último mensaje
      if (currentMessage) {
        this.messages.push(currentMessage);
      }

      return this.messages;
    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      return [];
    }
  }

  extractPlayerLists(): PlayerList[] {
    const playerLists: PlayerList[] = [];

    for (const message of this.messages) {
      // Buscar mensajes que contengan listas de jugadores
      if (this.isPlayerListMessage(message.content)) {
        const playerList = this.parsePlayerList(message);
        if (playerList) {
          playerLists.push(playerList);
        }
      }
    }

    return playerLists;
  }

  private isPlayerListMessage(content: string): boolean {
    // Verificar si el mensaje contiene patrones típicos de listas de jugadores
    const patterns = [
      /\d+\.\s*-?\s*\w+/, // Patrón como "1. - Alex" o "2. Moises"
      /Día:\s*\w+/, // "Día: viernes"
      /Hora:\s*[\d:]+/, // "Hora: 9:00"
      /Lugar:\s*.+/, // "Lugar: Potokar"
    ];

    return patterns.some((pattern) => pattern.test(content));
  }

  private parsePlayerList(message: WhatsAppMessage): PlayerList | null {
    try {
      const lines = message.content.split('\n');
      let eventName = '';
      let date = '';
      let time = '';
      let location = '';
      const players: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) continue;

        // Extraer información del evento
        if (
          trimmedLine.includes('Pichanga') ||
          trimmedLine.includes('año nuevo')
        ) {
          eventName = trimmedLine;
        } else if (trimmedLine.startsWith('Día:')) {
          date = trimmedLine.replace('Día:', '').trim();
        } else if (trimmedLine.startsWith('Hora:')) {
          time = trimmedLine.replace('Hora:', '').trim();
        } else if (trimmedLine.startsWith('Lugar:')) {
          location = trimmedLine.replace('Lugar:', '').trim();
        } else if (/^\d+\.\s*-?\s*(.+)/.test(trimmedLine)) {
          // Extraer jugadores (formato: "1. - Alex" o "2. Moises(4)")
          const playerMatch = trimmedLine.match(/^\d+\.\s*-?\s*(.+)/);
          if (playerMatch && playerMatch[1].trim() !== '-') {
            players.push(playerMatch[1].trim());
          }
        }
      }

      return {
        eventName,
        date,
        time,
        location,
        players,
        messageTimestamp: message.timestamp,
        sender: message.sender,
      };
    } catch (error) {
      console.error('Error parseando lista de jugadores:', error);
      return null;
    }
  }

  exportToJSON(data: any, filename: string): void {
    try {
      writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`✅ Datos exportados a: ${filename}`);
    } catch (error) {
      console.error('Error exportando JSON:', error);
    }
  }

  printStats(): void {
    console.log('\n📊 Estadísticas:');
    console.log(`- Total de mensajes: ${this.messages.length}`);

    const senders = new Set(this.messages.map((m) => m.sender));
    console.log(`- Participantes únicos: ${senders.size}`);
    console.log(`- Participantes: ${Array.from(senders).join(', ')}`);

    const playerLists = this.extractPlayerLists();
    console.log(`- Listas de jugadores encontradas: ${playerLists.length}`);
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Uso: bun run 1-parse-messages.ts <ruta-del-archivo-chat.txt>');
    console.log('📝 Ejemplo: bun run 1-parse-messages.ts ./data/wp_chat_from_2025.txt');
    process.exit(1);
  }

  const filePath = resolve(args[0]);
  console.log(`🔄 Procesando archivo: ${filePath}`);

  const parser = new WhatsAppParser();

  // Parsear mensajes
  const messages = parser.parseFile(filePath);

  if (messages.length === 0) {
    console.log('❌ No se encontraron mensajes válidos');
    return;
  }

  // Extraer listas de jugadores
  const playerLists = parser.extractPlayerLists();

  // Mostrar estadísticas
  parser.printStats();

  // Exportar resultados
  parser.exportToJSON(messages, 'output/first/messages.json');
  parser.exportToJSON(playerLists, 'output/first/player-list.json');

  // Mostrar algunas listas de ejemplo
  if (playerLists.length > 0) {
    console.log('\n🏆 Ejemplo de listas de jugadores:');
    playerLists.slice(0, 2).forEach((list, index) => {
      console.log(`\n--- Lista ${index + 1} ---`);
      console.log(`Evento: ${list.eventName}`);
      console.log(`Fecha: ${list.date}`);
      console.log(`Hora: ${list.time}`);
      console.log(`Lugar: ${list.location}`);
      console.log(`Enviado por: ${list.sender} (${list.messageTimestamp})`);
      console.log(`Jugadores (${list.players.length}):`);
      list.players.forEach((player, i) => {
        console.log(`  ${i + 1}. ${player}`);
      });
    });
  }

  console.log('\n✅ Proceso completado!');
}

main().catch(console.error);

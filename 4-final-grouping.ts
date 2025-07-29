#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import * as stringSimilarity from 'string-similarity';

// Tipos TypeScript
interface Player {
  name: string;
  cleanName: string;
  attendance: number;
  events: string[];
  variations: string[];
}

interface JsonData {
  metadata: {
    totalEvents: number;
    totalPlayers: number;
    generatedAt: string;
    description: string;
  };
  rankings: Player[];
}

interface ConsolidatedPlayer {
  name: string;
  totalAttendance: number;
  variations: string;
}

// Configuración
const SIMILARITY_LEVEL: 1 | 2 | 3 = 2; // 1 = muy estricto, 2 = moderado, 3 = flexible
const MIN_ATTENDANCE = 2; // Solo guardar jugadores con 2 o más asistencias

const INPUT_FILE = 'output/third/player-ranking.json';
const OUTPUT_FILE = 'output/final/final_players.csv';

// Mapeo de niveles de similitud a umbrales
const SIMILARITY_THRESHOLDS = {
  1: 0.9, // muy estricto
  2: 0.8, // moderado
  3: 0.7, // flexible
};

/**
 * Limpia un nombre removiendo caracteres especiales, emojis y espacios extras
 */
function cleanName(name: string): string {
  return name
    .normalize('NFD') // descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // remueve diacríticos
    .replace(/[^\w\s]/g, '') // remueve caracteres especiales y emojis
    .replace(/\s+/g, ' ') // normaliza espacios
    .trim()
    .toLowerCase();
}

/**
 * Obtiene el primer nombre que aparece en el grupo (del JSON original)
 */
function getOriginalName(group: Player[]): string {
  return group[0].name; // Usar el nombre del primer jugador del grupo
}

/**
 * Agrupa jugadores por similitud de nombres
 */
function groupSimilarPlayers(players: Player[]): Player[][] {
  const threshold = SIMILARITY_THRESHOLDS[SIMILARITY_LEVEL];
  const groups: Player[][] = [];
  const processed = new Set<number>();

  players.forEach((player, index) => {
    if (processed.has(index)) return;

    const group = [player];
    const cleanCurrentName = cleanName(player.name);

    // Buscar jugadores similares
    players.forEach((otherPlayer, otherIndex) => {
      if (otherIndex <= index || processed.has(otherIndex)) return;

      const cleanOtherName = cleanName(otherPlayer.name);
      const similarity = stringSimilarity.compareTwoStrings(
        cleanCurrentName,
        cleanOtherName
      );

      if (similarity >= threshold) {
        group.push(otherPlayer);
        processed.add(otherIndex);
      }
    });

    groups.push(group);
    processed.add(index);
  });

  return groups;
}

/**
 * Consolida un grupo de jugadores similares
 */
function consolidateGroup(group: Player[]): ConsolidatedPlayer {
  const allVariations: string[] = [];
  const allEvents: string[] = [];
  let totalAttendance = 0;

  group.forEach((player) => {
    totalAttendance += player.attendance;
    allEvents.push(...(player.events || []));
    allVariations.push(...(player.variations || [player.name]));
  });

  // Remover duplicados de eventos
  const uniqueEvents = [...new Set(allEvents)];

  // Remover duplicados de variaciones
  const uniqueVariations = [...new Set(allVariations)];

  // Usar el nombre original del primer jugador
  const finalName = getOriginalName(group);

  return {
    name: finalName,
    totalAttendance: totalAttendance,
    variations: uniqueVariations.join(', '),
  };
}

/**
 * Procesa el archivo JSON y genera el CSV consolidado
 */
async function processPlayersData(): Promise<void> {
  try {
    console.log(
      `📊 Iniciando consolidación con nivel de similitud ${SIMILARITY_LEVEL} (umbral: ${SIMILARITY_THRESHOLDS[SIMILARITY_LEVEL]})`
    );
    console.log(`🎯 Filtro: Solo jugadores con ${MIN_ATTENDANCE}+ asistencias`);

    // Leer archivo JSON
    console.log(`📂 Leyendo archivo: ${INPUT_FILE}`);
    const jsonData: JsonData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

    if (!jsonData.rankings || jsonData.rankings.length === 0) {
      console.log('❌ No se encontraron datos de rankings en el archivo');
      return;
    }

    console.log(`👥 Jugadores originales: ${jsonData.rankings.length}`);

    // Agrupar jugadores similares
    console.log('🔍 Agrupando jugadores similares...');
    const groups = groupSimilarPlayers(jsonData.rankings);

    // Consolidar cada grupo
    console.log('🔄 Consolidando grupos...');
    const consolidatedPlayers = groups.map(consolidateGroup);

    // Filtrar solo jugadores con 2 o más asistencias
    const filteredPlayers = consolidatedPlayers.filter(
      (player) => player.totalAttendance >= MIN_ATTENDANCE
    );

    // Ordenar por asistencias (descendente)
    filteredPlayers.sort((a, b) => b.totalAttendance - a.totalAttendance);

    console.log(`✅ Jugadores consolidados: ${consolidatedPlayers.length}`);
    console.log(
      `🎯 Jugadores con ${MIN_ATTENDANCE}+ asistencias: ${filteredPlayers.length}`
    );
    console.log(
      `📈 Reducción total: ${
        jsonData.rankings.length - filteredPlayers.length
      } jugadores eliminados`
    );

    // Crear CSV
    console.log(`💾 Generando archivo CSV: ${OUTPUT_FILE}`);
    const csvWriter = createObjectCsvWriter({
      path: OUTPUT_FILE,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'totalAttendance', title: 'Total Attendance' },
        { id: 'variations', title: 'Variations' },
      ],
    });

    await csvWriter.writeRecords(filteredPlayers);

    console.log('🎉 ¡Proceso completado exitosamente!');
    console.log(`📄 Archivo generado: ${OUTPUT_FILE}`);

    // Mostrar preview de los top 5
    console.log('\n📋 Top 5 jugadores:');
    filteredPlayers.slice(0, 5).forEach((player, index) => {
      console.log(
        `${index + 1}. ${player.name} - ${player.totalAttendance} asistencias`
      );
    });
  } catch (error) {
    console.error('❌ Error procesando datos:', (error as Error).message);
    process.exit(1);
  }
}

// Ejecutar el script
processPlayersData();

#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import stringSimilarity from 'string-similarity';

// Configuración
const SIMILARITY_LEVEL = 2; // 1 = muy estricto, 2 = moderado, 3 = flexible
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
function cleanName(name) {
  return name
    .normalize('NFD') // descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // remueve diacríticos
    .replace(/[^\w\s]/g, '') // remueve caracteres especiales y emojis
    .replace(/\s+/g, ' ') // normaliza espacios
    .trim()
    .toLowerCase();
}

/**
 * Encuentra el nombre más frecuente en un array de variaciones
 */
function getMostFrequentName(variations) {
  const frequency = {};
  variations.forEach((name) => {
    frequency[name] = (frequency[name] || 0) + 1;
  });

  return Object.keys(frequency).reduce((a, b) =>
    frequency[a] > frequency[b] ? a : b
  );
}

/**
 * Agrupa jugadores por similitud de nombres
 */
function groupSimilarPlayers(players) {
  const threshold = SIMILARITY_THRESHOLDS[SIMILARITY_LEVEL];
  const groups = [];
  const processed = new Set();

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
function consolidateGroup(group) {
  const allVariations = [];
  let totalAttendance = 0;

  group.forEach((player) => {
    totalAttendance += player.attendance;
    allVariations.push(...(player.variations || [player.name]));
  });

  // Remover duplicados de variaciones
  const uniqueVariations = [...new Set(allVariations)];

  // Encontrar el nombre más frecuente
  const finalName = getMostFrequentName(uniqueVariations);

  return {
    name: finalName,
    totalAttendance: totalAttendance,
    variations: uniqueVariations.join(', '),
  };
}

/**
 * Procesa el archivo JSON y genera el CSV consolidado
 */
async function processPlayersData() {
  try {
    console.log(
      `📊 Iniciando consolidación con nivel de similitud ${SIMILARITY_LEVEL} (umbral: ${SIMILARITY_THRESHOLDS[SIMILARITY_LEVEL]})`
    );

    // Leer archivo JSON
    console.log(`📂 Leyendo archivo: ${INPUT_FILE}`);
    const jsonData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));

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

    // Ordenar por asistencias (descendente)
    consolidatedPlayers.sort((a, b) => b.totalAttendance - a.totalAttendance);

    console.log(`✅ Jugadores consolidados: ${consolidatedPlayers.length}`);
    console.log(
      `📈 Reducción: ${
        jsonData.rankings.length - consolidatedPlayers.length
      } duplicados eliminados`
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

    await csvWriter.writeRecords(consolidatedPlayers);

    console.log('🎉 ¡Proceso completado exitosamente!');
    console.log(`📄 Archivo generado: ${OUTPUT_FILE}`);

    // Mostrar preview de los top 5
    console.log('\n📋 Top 5 jugadores:');
    consolidatedPlayers.slice(0, 5).forEach((player, index) => {
      console.log(
        `${index + 1}. ${player.name} - ${player.totalAttendance} asistencias`
      );
    });
  } catch (error) {
    console.error('❌ Error procesando datos:', error.message);
    process.exit(1);
  }
}

processPlayersData();

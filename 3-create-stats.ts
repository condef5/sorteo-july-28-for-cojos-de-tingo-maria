#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface FilteredEvent {
  eventName: string;
  eventDate: string;
  dayOfWeek: string;
  time: string;
  location: string;
  players: string[];
  totalPlayers: number;
  messageTimestamp: string;
  sender: string;
}

interface ProcessedData {
  metadata: any;
  events: FilteredEvent[];
}

interface PlayerStats {
  name: string;
  cleanName: string;
  attendance: number;
  events: string[]; // Fechas de los eventos donde participó
  variations: string[]; // Diferentes formas como apareció el nombre
}

interface PlayerRanking {
  metadata: {
    totalEvents: number;
    totalPlayers: number;
    generatedAt: string;
    description: string;
  };
  rankings: PlayerStats[];
}

class PlayerStatsAnalyzer {
  // 🔧 CONFIGURACIÓN DE ALIASES - Modifica este objeto para mapear usuarios múltiples
  private readonly playerAliases: { [key: string]: string } = {
    // Ejemplo: diferentes nombres/usernames de la misma persona
    conde: 'Spectre', // conde es Spectre
    Spectre: 'Spectre', // nombre principal
    Dayler: 'Dayler',
    Deyler: 'Dayler',
    Kenyi: 'Sebas',
    Sebas: 'Sebas',
    Sebastian: 'Sebas',
  };

  private cleanPlayerName(playerName: string): string {
    // Limpieza exhaustiva de espacios y caracteres especiales
    let cleaned = playerName
      .replace(/\([^)]*\)/g, '') // Remover (contenido)
      .replace(/\[[^\]]*\]/g, '') // Remover [contenido]
      .replace(/\{[^}]*\}/g, '') // Remover {contenido}
      .replace(/[‎<>]/g, '') // Remover caracteres especiales invisibles
      .replace(/\s*go\s*$/i, '') // Remover "go" al final
      .replace(/\s*-\s*$/, '') // Remover guiones al final
      .replace(/[🔥⭐✨💪👑🏆⚽]/g, '') // Remover emojis comunes
      .replace(/\s+/g, ' ') // Normalizar espacios múltiples a uno solo
      .trim(); // Remover espacios al inicio y final

    // Si queda vacío después de la limpieza, retornar string vacío
    if (!cleaned) {
      return '';
    }

    // Convertir a formato consistente (primera letra mayúscula de cada palabra)
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return cleaned;
  }

  private normalizePlayerName(cleanName: string): string {
    // Primero, normalizar espacios extra y capitalización
    const normalized = cleanName.replace(/\s+/g, ' ').trim().toLowerCase();

    // Buscar en el objeto de aliases (case-insensitive)
    for (const [alias, mainName] of Object.entries(this.playerAliases)) {
      if (alias.toLowerCase() === normalized) {
        return mainName;
      }
    }

    // Si no se encuentra alias, retornar el nombre limpio con capitalización correcta
    return cleanName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private processPlayers(events: FilteredEvent[]): Map<string, PlayerStats> {
    const playerMap = new Map<string, PlayerStats>();

    for (const event of events) {
      const eventKey = `${event.eventDate} (${event.dayOfWeek})`;

      for (const playerName of event.players) {
        if (!playerName || playerName.trim() === '' || playerName === '-') {
          continue;
        }

        const cleanName = this.cleanPlayerName(playerName);
        const normalizedName = this.normalizePlayerName(cleanName);

        if (!normalizedName) continue;

        if (!playerMap.has(normalizedName)) {
          playerMap.set(normalizedName, {
            name: normalizedName,
            cleanName: normalizedName,
            attendance: 0,
            events: [],
            variations: [],
          });
        }

        const playerStats = playerMap.get(normalizedName)!;

        // Incrementar asistencia
        playerStats.attendance++;

        // Agregar evento si no existe ya
        if (!playerStats.events.includes(eventKey)) {
          playerStats.events.push(eventKey);
        }

        // Agregar variación del nombre si no existe ya
        if (!playerStats.variations.includes(playerName.trim())) {
          playerStats.variations.push(playerName.trim());
        }
      }
    }

    return playerMap;
  }

  analyzePlayerStats(filePath: string): PlayerRanking {
    try {
      console.log(`📖 Leyendo archivo: ${filePath}`);
      const jsonContent = readFileSync(filePath, 'utf-8');
      const data: ProcessedData = JSON.parse(jsonContent);

      console.log(`📊 Total de eventos cargados: ${data.events.length}`);

      // Procesar jugadores
      const playerMap = this.processPlayers(data.events);

      // Convertir a array y ordenar por asistencias
      const rankings = Array.from(playerMap.values()).sort(
        (a, b) => b.attendance - a.attendance
      );

      console.log(`👥 Total de jugadores únicos: ${rankings.length}`);

      return {
        metadata: {
          totalEvents: data.events.length,
          totalPlayers: rankings.length,
          generatedAt: new Date().toISOString(),
          description: 'Ranking de jugadores por asistencias a pichangas',
        },
        rankings,
      };
    } catch (error) {
      console.error('❌ Error analizando estadísticas:', error);
      return {
        metadata: {
          totalEvents: 0,
          totalPlayers: 0,
          generatedAt: new Date().toISOString(),
          description: 'Error en el análisis',
        },
        rankings: [],
      };
    }
  }

  exportRanking(ranking: PlayerRanking, outputPath: string): void {
    try {
      writeFileSync(outputPath, JSON.stringify(ranking, null, 2), 'utf-8');
      console.log(`✅ Ranking exportado a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando ranking:', error);
    }
  }

  printTopPlayers(ranking: PlayerRanking, topN: number = 20): void {
    console.log('\n🏆 TOP JUGADORES POR ASISTENCIAS:');
    console.log('='.repeat(60));

    const topPlayers = ranking.rankings.slice(0, topN);

    topPlayers.forEach((player, index) => {
      const medal =
        index === 0
          ? '🥇'
          : index === 1
          ? '🥈'
          : index === 2
          ? '🥉'
          : `${index + 1}.`;

      console.log(`\n${medal} ${player.name}`);
      console.log(`   📊 Asistencias: ${player.attendance}`);
      console.log(`   📅 Eventos únicos: ${player.events.length}`);

      if (player.variations.length > 1) {
        console.log(
          `   🔄 Variaciones encontradas: ${player.variations.join(', ')}`
        );
      }

      // Mostrar algunos eventos recientes
      if (player.events.length > 0) {
        const recentEvents = player.events.slice(-3);
        console.log(`   📆 Últimos eventos: ${recentEvents.join(', ')}`);
      }
    });
  }

  printAliasesUsed(ranking: PlayerRanking): void {
    console.log('\n🔗 ALIASES DETECTADOS:');
    console.log('='.repeat(50));

    const playersWithAliases = ranking.rankings.filter(
      (p) => p.variations.length > 1
    );

    if (playersWithAliases.length === 0) {
      console.log('   No se encontraron jugadores con múltiples variaciones');
      return;
    }

    playersWithAliases.forEach((player) => {
      console.log(`\n👤 ${player.name}:`);
      console.log(`   🔄 Aparece como: ${player.variations.join(', ')}`);
      console.log(`   📊 Total asistencias: ${player.attendance}`);
    });

    console.log('\n💡 SUGERENCIA:');
    console.log('Si encuentras nombres que deberían ser la misma persona,');
    console.log(
      'agrega las variaciones al objeto "playerAliases" en el código.'
    );
  }

  exportDetailedStats(ranking: PlayerRanking, outputPath: string): void {
    try {
      // Crear estadísticas más detalladas para exportar
      const detailedStats = {
        ...ranking,
        aliasesUsed: ranking.rankings
          .filter((p) => p.variations.length > 1)
          .map((p) => ({
            mainName: p.name,
            variations: p.variations,
            attendance: p.attendance,
          })),
        configuredAliases: this.playerAliases,
        suggestions: {
          description:
            'Revisa estos jugadores para posibles aliases adicionales',
          playersToReview: ranking.rankings
            .filter((p) => p.attendance >= 3 && p.variations.length === 1)
            .slice(0, 20)
            .map((p) => ({ name: p.name, attendance: p.attendance })),
        },
      };

      writeFileSync(
        outputPath,
        JSON.stringify(detailedStats, null, 2),
        'utf-8'
      );
      console.log(`✅ Estadísticas detalladas exportadas a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando estadísticas detalladas:', error);
    }
  }

  printStatistics(ranking: PlayerRanking): void {
    console.log('\n📈 ESTADÍSTICAS GENERALES:');
    console.log('='.repeat(40));

    const attendances = ranking.rankings.map((p) => p.attendance);
    const totalAttendances = attendances.reduce((sum, att) => sum + att, 0);
    const avgAttendance =
      attendances.length > 0 ? totalAttendances / attendances.length : 0;
    const maxAttendance = Math.max(...attendances);
    const minAttendance = Math.min(...attendances);

    console.log(`📊 Total de eventos: ${ranking.metadata.totalEvents}`);
    console.log(`👥 Jugadores únicos: ${ranking.metadata.totalPlayers}`);
    console.log(`📈 Asistencias totales: ${totalAttendances}`);
    console.log(
      `📊 Promedio de asistencias por jugador: ${avgAttendance.toFixed(1)}`
    );
    console.log(`🔝 Máximo de asistencias: ${maxAttendance}`);
    console.log(`🔻 Mínimo de asistencias: ${minAttendance}`);

    // Distribución por rangos de asistencia
    const ranges = [
      { min: 20, max: Infinity, label: '20+ asistencias' },
      { min: 15, max: 19, label: '15-19 asistencias' },
      { min: 10, max: 14, label: '10-14 asistencias' },
      { min: 5, max: 9, label: '5-9 asistencias' },
      { min: 1, max: 4, label: '1-4 asistencias' },
    ];

    console.log('\n📊 DISTRIBUCIÓN POR ASISTENCIAS:');
    ranges.forEach((range) => {
      const count = attendances.filter(
        (att) =>
          att >= range.min && (range.max === Infinity ? true : att <= range.max)
      ).length;
      console.log(`   ${range.label}: ${count} jugadores`);
    });
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Uso: bun run stats.ts <eventos-filtrados.json> [top-N]');
    console.log('📝 Ejemplo: bun run stats.ts eventos-filtrados.json 30');
    process.exit(1);
  }

  const inputPath = resolve(args[0]);
  const topN = args[1] ? parseInt(args[1]) : 20;
  const outputPath = resolve('output/third/player-ranking.json');

  const analyzer = new PlayerStatsAnalyzer();

  // Analizar estadísticas
  const ranking = analyzer.analyzePlayerStats(inputPath);

  if (ranking.rankings.length === 0) {
    console.log('❌ No se encontraron jugadores válidos');
    return;
  }

  // Mostrar top jugadores
  analyzer.printTopPlayers(ranking, topN);

  // Mostrar aliases detectados
  analyzer.printAliasesUsed(ranking);

  // Mostrar estadísticas generales
  analyzer.printStatistics(ranking);

  // Exportar ranking simple
  analyzer.exportRanking(ranking, outputPath);

  // Exportar estadísticas detalladas con aliases y sugerencias
  const detailedOutputPath = resolve('ranking-detallado.json');
  analyzer.exportDetailedStats(ranking, detailedOutputPath);

  console.log('\n✅ Análisis de estadísticas completado!');
  console.log(`📁 Archivos generados:`);
  console.log(`   📊 Ranking básico: ${outputPath}`);
  console.log(`   📈 Análisis detallado: ${detailedOutputPath}`);
}

// Ejecutar si es llamado directamente
main().catch(console.error);

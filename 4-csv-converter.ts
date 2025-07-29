#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface PlayerStats {
  name: string;
  cleanName: string;
  attendance: number;
  events: string[];
  variations: string[];
}

interface DetailedRanking {
  metadata: {
    totalEvents: number;
    totalPlayers: number;
    generatedAt: string;
    description: string;
  };
  rankings: PlayerStats[];
  aliasesUsed?: any[];
  configuredAliases?: any;
  suggestions?: any;
}

class JSONToCSVConverter {
  private escapeCSVField(field: string): string {
    // Escapar campos que contienen comas, comillas o saltos de línea
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private convertRankingToCSV(rankings: PlayerStats[]): string {
    // Headers del CSV
    const headers = [
      'Posicion',
      'Nombre',
      'Asistencias',
      'Eventos_Unicos',
      'Promedio_Asistencias_Por_Evento',
      'Variaciones_Nombres',
      'Cantidad_Variaciones',
      'Ultimos_3_Eventos',
      'Primer_Evento',
      'Ultimo_Evento',
    ];

    const csvLines = [headers.join(',')];

    rankings.forEach((player, index) => {
      const position = index + 1;
      const name = this.escapeCSVField(player.name);
      const attendance = player.attendance;
      const uniqueEvents = player.events.length;
      const avgAttendancePerEvent =
        uniqueEvents > 0 ? (attendance / uniqueEvents).toFixed(2) : '0';
      const variations = this.escapeCSVField(player.variations.join(' | '));
      const variationCount = player.variations.length;

      // Últimos 3 eventos
      const last3Events = this.escapeCSVField(
        player.events.slice(-3).join(' | ')
      );

      // Primer y último evento
      const firstEvent =
        player.events.length > 0 ? this.escapeCSVField(player.events[0]) : '';
      const lastEvent =
        player.events.length > 0
          ? this.escapeCSVField(player.events[player.events.length - 1])
          : '';

      const row = [
        position,
        name,
        attendance,
        uniqueEvents,
        avgAttendancePerEvent,
        variations,
        variationCount,
        last3Events,
        firstEvent,
        lastEvent,
      ];

      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  private convertAliasesToCSV(aliasesUsed: any[]): string {
    if (!aliasesUsed || aliasesUsed.length === 0) {
      return 'Nombre_Principal,Variaciones,Asistencias\n';
    }

    const headers = ['Nombre_Principal', 'Variaciones', 'Asistencias'];
    const csvLines = [headers.join(',')];

    aliasesUsed.forEach((alias) => {
      const mainName = this.escapeCSVField(alias.mainName);
      const variations = this.escapeCSVField(alias.variations.join(' | '));
      const attendance = alias.attendance;

      csvLines.push([mainName, variations, attendance].join(','));
    });

    return csvLines.join('\n');
  }

  private convertSuggestionsToCSV(suggestions: any): string {
    if (!suggestions || !suggestions.playersToReview) {
      return 'Nombre,Asistencias,Nota\n';
    }

    const headers = ['Nombre', 'Asistencias', 'Nota'];
    const csvLines = [headers.join(',')];

    suggestions.playersToReview.forEach((player: any) => {
      const name = this.escapeCSVField(player.name);
      const attendance = player.attendance;
      const note = this.escapeCSVField('Revisar para posibles aliases');

      csvLines.push([name, attendance, note].join(','));
    });

    return csvLines.join('\n');
  }

  private generateSummaryCSV(metadata: any, rankings: PlayerStats[]): string {
    const headers = ['Metrica', 'Valor'];
    const csvLines = [headers.join(',')];

    // Estadísticas básicas
    const stats = [
      ['Total_Eventos', metadata.totalEvents],
      ['Total_Jugadores', metadata.totalPlayers],
      ['Fecha_Generacion', metadata.generatedAt],
      ['', ''], // Línea vacía
      ['=== ESTADISTICAS CALCULADAS ===', ''],
      ['Jugador_Mas_Activo', rankings[0]?.name || 'N/A'],
      ['Max_Asistencias', rankings[0]?.attendance || 0],
      ['Jugador_Menos_Activo', rankings[rankings.length - 1]?.name || 'N/A'],
      ['Min_Asistencias', rankings[rankings.length - 1]?.attendance || 0],
    ];

    // Calcular estadísticas adicionales
    if (rankings.length > 0) {
      const attendances = rankings.map((p) => p.attendance);
      const totalAttendances = attendances.reduce((sum, att) => sum + att, 0);
      const avgAttendance = totalAttendances / attendances.length;
      const medianAttendance = attendances.sort((a, b) => a - b)[
        Math.floor(attendances.length / 2)
      ];

      stats.push(
        ['Promedio_Asistencias', avgAttendance.toFixed(2)],
        ['Mediana_Asistencias', medianAttendance],
        ['Total_Asistencias_Registradas', totalAttendances]
      );

      // Distribución por rangos
      const ranges = [
        { min: 20, max: Infinity, label: 'Jugadores_20_Plus' },
        { min: 15, max: 19, label: 'Jugadores_15_19' },
        { min: 10, max: 14, label: 'Jugadores_10_14' },
        { min: 5, max: 9, label: 'Jugadores_5_9' },
        { min: 1, max: 4, label: 'Jugadores_1_4' },
      ];

      stats.push(['', ''], ['=== DISTRIBUCION POR RANGOS ===', '']);

      ranges.forEach((range) => {
        const count = attendances.filter(
          (att) =>
            att >= range.min &&
            (range.max === Infinity ? true : att <= range.max)
        ).length;
        stats.push([range.label, count]);
      });
    }

    stats.forEach(([metric, value]) => {
      csvLines.push(
        [
          this.escapeCSVField(metric.toString()),
          this.escapeCSVField(value.toString()),
        ].join(',')
      );
    });

    return csvLines.join('\n');
  }

  convertToCSV(filePath: string): void {
    try {
      console.log(`📖 Leyendo archivo JSON: ${filePath}`);

      const jsonContent = readFileSync(filePath, 'utf-8');
      const data: DetailedRanking = JSON.parse(jsonContent);

      console.log(`📊 Procesando ${data.rankings.length} jugadores...`);

      // Generar múltiples archivos CSV
      const baseFileName = 'player';

      // 1. Ranking principal
      const rankingCSV = this.convertRankingToCSV(data.rankings);
      console.log({ baseFileName });
      const rankingPath = `./output/four/${baseFileName}_ranking.csv`;
      writeFileSync(rankingPath, rankingCSV, 'utf-8');
      console.log(`✅ Ranking exportado: ${rankingPath}`);

      // 2. Aliases detectados
      if (data.aliasesUsed && data.aliasesUsed.length > 0) {
        const aliasesCSV = this.convertAliasesToCSV(data.aliasesUsed);
        const aliasesPath = `output/four/${baseFileName}_aliases.csv`;
        writeFileSync(aliasesPath, aliasesCSV, 'utf-8');
        console.log(`✅ Aliases exportados: ${aliasesPath}`);
      }

      // 3. Sugerencias para revisar
      if (data.suggestions) {
        const suggestionsCSV = this.convertSuggestionsToCSV(data.suggestions);
        const suggestionsPath = `output/four/${baseFileName}_sugerencias.csv`;
        writeFileSync(suggestionsPath, suggestionsCSV, 'utf-8');
        console.log(`✅ Sugerencias exportadas: ${suggestionsPath}`);
      }

      // 4. Resumen estadístico
      const summaryCSV = this.generateSummaryCSV(data.metadata, data.rankings);
      const summaryPath = `output/four/${baseFileName}_resumen.csv`;
      writeFileSync(summaryPath, summaryCSV, 'utf-8');
      console.log(`✅ Resumen estadístico: ${summaryPath}`);

      // 5. CSV consolidado con top jugadores
      const topN = Math.min(50, data.rankings.length);
      const topPlayersCSV = this.convertRankingToCSV(
        data.rankings.slice(0, topN)
      );
      const topPath = `output/four/${baseFileName}_top${topN}.csv`;
      writeFileSync(topPath, topPlayersCSV, 'utf-8');
      console.log(`✅ Top ${topN} jugadores: ${topPath}`);

      this.printCSVSummary(data, baseFileName);
    } catch (error) {
      console.error('❌ Error convirtiendo a CSV:', error);
    }
  }

  private printCSVSummary(data: DetailedRanking, baseFileName: string): void {
    console.log('\n📋 ARCHIVOS CSV GENERADOS:');
    console.log('='.repeat(50));
    console.log(`📊 ${baseFileName}_ranking.csv`);
    console.log(`   └── Ranking completo de todos los jugadores`);
    console.log(`📊 ${baseFileName}_top50.csv`);
    console.log(`   └── Top 50 jugadores más activos`);
    console.log(`📊 ${baseFileName}_aliases.csv`);
    console.log(`   └── Jugadores con múltiples nombres detectados`);
    console.log(`📊 ${baseFileName}_sugerencias.csv`);
    console.log(`   └── Jugadores para revisar manualmente`);
    console.log(`📊 ${baseFileName}_resumen.csv`);
    console.log(`   └── Estadísticas generales y distribuciones`);

    console.log('\n📈 COLUMNAS EN EL RANKING PRINCIPAL:');
    console.log('   • Posicion: Ranking por asistencias');
    console.log('   • Nombre: Nombre principal del jugador');
    console.log('   • Asistencias: Total de apariciones');
    console.log('   • Eventos_Unicos: Cantidad de eventos diferentes');
    console.log('   • Promedio_Asistencias_Por_Evento: Ratio de participación');
    console.log('   • Variaciones_Nombres: Todas las formas como apareció');
    console.log('   • Cantidad_Variaciones: Número de aliases diferentes');
    console.log('   • Ultimos_3_Eventos: Eventos más recientes');
    console.log('   • Primer_Evento: Primera aparición');
    console.log('   • Ultimo_Evento: Última aparición');

    console.log('\n💡 SUGERENCIAS DE USO:');
    console.log('   🔍 Abre el archivo _ranking.csv en Excel/Google Sheets');
    console.log(
      '   📊 Usa filtros para analizar jugadores por rango de asistencias'
    );
    console.log('   🔗 Revisa _aliases.csv para validar unificaciones');
    console.log(
      '   📝 Usa _sugerencias.csv para encontrar posibles duplicados'
    );
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Uso: bun run csv-converter.ts <ranking-detallado.json>');
    console.log('📝 Ejemplo: bun run csv-converter.ts ranking-detallado.json');
    console.log('');
    console.log('📊 El script generará múltiples archivos CSV:');
    console.log('   • ranking.csv - Ranking completo');
    console.log('   • top50.csv - Top 50 jugadores');
    console.log('   • aliases.csv - Aliases detectados');
    console.log('   • sugerencias.csv - Para revisar manualmente');
    console.log('   • resumen.csv - Estadísticas generales');
    process.exit(1);
  }

  const inputPath = resolve(args[0]);

  if (!inputPath.endsWith('.json')) {
    console.log('⚠️  Advertencia: El archivo debería ser un JSON');
  }

  const converter = new JSONToCSVConverter();
  converter.convertToCSV(inputPath);

  console.log('\n✅ Conversión a CSV completada exitosamente!');
  console.log(
    '🎯 Ahora puedes abrir los archivos CSV en Excel, Google Sheets, etc.'
  );
}

main().catch(console.error);

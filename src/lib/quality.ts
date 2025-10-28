// frontend/src/lib/quality.ts
import { CleaningReport, RawData } from './cleaning';

export type QualityMetrics = {
  completeness: number; // % cellules non vides
  validity: number;     // % cellules valides (format, type)
  uniqueness: number;   // % lignes uniques
  consistency: number;  // % colonnes sans erreur de format (après normalisation)
  outliers_ok: number;  // % cellules numériques non-outliers
};

/**
 * Calcule un pourcentage sûr (0-100), évite la division par zéro.
 */
export function pct(n: number, d: number): number {
  if (d === 0) return 100; // Si le dénominateur est 0, on considère 100% (pas d'erreurs)
  return Math.max(0, Math.min(100, (n / d) * 100));
}

/**
 * Calcule le score de qualité V2 pondéré.
 * @param m Métriques (valeurs de 0 à 100)
 * @returns Score de 0 à 100
 */
export function qualityScoreV2(m: QualityMetrics): number {
  const score =
    m.validity * 0.35 +
    m.completeness * 0.25 +
    m.uniqueness * 0.15 +
    m.consistency * 0.15 +
    m.outliers_ok * 0.10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calcule les métriques de qualité à partir des données brutes (Avant)
 */
export function computeQualityReportBefore(
  data: RawData[],
  colTypes: CleaningReport['colTypes']
): { metrics: QualityMetrics; summary: string } {
  // Pour "Avant", on fait un simple scan
  const rowCount = data.length;
  if (rowCount === 0) return { metrics: { completeness: 0, validity: 0, uniqueness: 0, consistency: 0, outliers_ok: 0 }, summary: "No data" };
  
  const colCount = Object.keys(colTypes).length;
  const totalCells = rowCount * colCount;
  let missingCells = 0;
  const rowHashes = new Set<string>();

  data.forEach(row => {
    let hash = '';
    for(const col of Object.keys(colTypes)) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === '') {
        missingCells++;
      }
      hash += `|${val}`;
    }
    rowHashes.add(hash);
  });
  
  const completeness = pct(totalCells - missingCells, totalCells);
  const uniqueness = pct(rowHashes.size, rowCount);

  // Pour "Avant", validité, consistance et outliers sont inconnus (ou 100% par défaut)
  // On va les mettre à 0 pour montrer un "mauvais" score de départ.
  const metrics: QualityMetrics = {
    completeness: completeness,
    validity: 0, // Inconnu avant analyse
    uniqueness: uniqueness,
    consistency: 0, // Inconnu avant analyse
    outliers_ok: 0, // Inconnu avant analyse
  };
  
  const summary = `${Math.round(completeness)}% complet, ${Math.round(uniqueness)}% unique.`;
  return { metrics, summary };
}


/**
 * Calcule les métriques de qualité à partir du rapport de nettoyage (Après)
 */
export function computeQualityReportAfter(
  report: CleaningReport
): { metrics: QualityMetrics; summary: string } {

  const {
    stats,
    invalidMap,
    duplicateIndices,
    outlierIdxByCol,
    proposalRows,
    colTypes
  } = report;

  const rowCount = stats.rowCount;
  const colCount = stats.colCount;
  if (rowCount === 0) return { metrics: { completeness: 0, validity: 0, uniqueness: 0, consistency: 0, outliers_ok: 0 }, summary: "No data" };

  const totalCells = rowCount * colCount;
  
  // 1. Completeness (après imputation éventuelle)
  let missingAfter = 0;
  proposalRows.forEach(row => {
    for (const col of Object.keys(colTypes)) {
      const val = row[col];
      if (val === null || val === undefined) {
        missingAfter++;
      }
    }
  });
  const completeness = pct(totalCells - missingAfter, totalCells);
  
  // 2. Validity (après correction ET imputation)
  let invalidsAfter = 0;
  invalidMap.forEach(indices => (invalidsAfter += indices.length));
  const validity = pct(totalCells - invalidsAfter, totalCells);
  
  // 3. Uniqueness (basé sur la détection, avant suppression)
  const uniqueness = pct(rowCount - duplicateIndices.size, rowCount);
  
  // 4. Consistency (colonnes sans erreur de format)
  const consistentCols = colCount - invalidMap.size;
  const consistency = pct(consistentCols, colCount);
  
  // 5. Outliers OK
  let totalNumericCells = 0;
  let totalOutliers = 0;
  for(const col of Object.keys(colTypes)) {
    if (colTypes[col] === 'number') {
      // On compte toutes les cellules de la colonne, même nulles, comme dénominateur
      totalNumericCells += rowCount;
    }
  }
  outlierIdxByCol.forEach(indices => (totalOutliers += indices.length));
  // Si pas de colonnes numériques, le score est 100 (pas d'outliers)
  const outliers_ok = pct(totalNumericCells - totalOutliers, totalNumericCells);

  const metrics: QualityMetrics = {
    completeness: Math.round(completeness),
    validity: Math.round(validity),
    uniqueness: Math.round(uniqueness),
    consistency: Math.round(consistency),
    outliers_ok: Math.round(outliers_ok),
  };
  
  const summary = `${metrics.validity}% valide, ${metrics.completeness}% complet, ${metrics.uniqueness}% unique.`;
  return { metrics, summary };
}

/**
 * Le contrat de document d'AIME FINAL (format `aime/document`, version 2).
 *
 * Une création = un document. Les nœuds sont stockés à plat (dictionnaire par
 * identifiant) et les grilles référencent leurs enfants par identifiant.
 * Ce format est la seule source de vérité : l'écran, l'export et, demain,
 * le serveur ou l'Orbe ne font que le lire ou produire un nouveau document.
 *
 * Repris d'AIMENEW (version 1) ; la version 2 ajoute `assets` (médias stockés
 * à part, référencés par `asset:<id>`) et `createdAt`. Voir docs/DOCUMENT.md.
 */

export const DOCUMENT_FORMAT = 'aime/document';
export const DOCUMENT_VERSION = 2;

export type NodeId = string;

/** Position d'un bloc dans la grille de son parent (indices à partir de 1). */
export interface Placement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface BlockNode {
  id: NodeId;
  /** Type de bloc, résolu par le registre (ex. "text", "image", "container"). */
  type: string;
  /** Données propres au bloc. Le noyau ne les interprète pas, sauf `columns`, `gap`, `rowHeight` pour une grille. */
  props: Record<string, unknown>;
  /** Placement dans la grille du parent. Ignoré pour la racine. */
  place: Placement;
  /** Présent uniquement si le bloc est une grille capable de contenir d'autres blocs. */
  children?: NodeId[];
}

/** Description d'un média. Le fichier lui-même vit dans le stockage, jamais dans le document. */
export interface AssetRef {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface AimeDocument {
  format: typeof DOCUMENT_FORMAT;
  version: typeof DOCUMENT_VERSION;
  id: string;
  title: string;
  /** Identifiant du Design System appliqué (tokens), indépendant du contenu. */
  designSystem: string;
  root: NodeId;
  nodes: Record<NodeId, BlockNode>;
  assets: Record<string, AssetRef>;
  createdAt: string;
  updatedAt: string;
}

/** Préfixe d'une référence de média dans les données d'un bloc. */
export const ASSET_PREFIX = 'asset:';

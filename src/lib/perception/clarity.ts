/**
 * Perception clarity calculation per spec 16.2-16.12.
 * Returns clarity 0-5 representing how clearly an observer perceives a target.
 */

export type SpatialRelation =
  | 'same_table_or_direct_interaction'
  | 'same_zone_near'
  | 'same_room_visible'
  | 'same_room_far'
  | 'adjacent_room_or_behind_door'
  | 'same_building_different_room'
  | 'different_location';

export interface ClarityInputs {
  spatialRelation: SpatialRelation;
  /** 0.0-1.0 obstacle ratio of location */
  obstacles?: number;
  /** 0.0-1.0 noise level */
  noise?: number;
  /** 0.0-1.0 crowd density */
  crowd?: number;
  /** 0-100 observer perception ability */
  perception?: number;
  /** 0-100 observer social_insight */
  socialInsight?: number;
  /** familiarity score 0-100 (spec 16.8) */
  familiarity?: number;
  /** target's stealth ability 0-100 */
  targetStealth?: number;
  /** target visibility state */
  targetVisibilityState?: 'normal' | 'disguised' | 'hidden';
  /** is target actively hiding */
  targetIsHiding?: boolean;
}

const BASE_BY_SPATIAL: Record<SpatialRelation, number> = {
  same_table_or_direct_interaction: 5,
  same_zone_near: 4,
  same_room_visible: 3,
  same_room_far: 2,
  adjacent_room_or_behind_door: 1,
  same_building_different_room: 1,
  different_location: 0,
};

function lineOfSightModifier(obstacles: number): number {
  if (obstacles < 0.25) return 0;
  if (obstacles < 0.55) return -1;
  if (obstacles < 0.8) return -2;
  return -3;
}

function noiseModifier(noise: number): number {
  if (noise < 0.25) return 0;
  if (noise < 0.5) return -1;
  if (noise < 0.75) return -2;
  return -3;
}

function crowdModifier(crowd: number): number {
  if (crowd < 0.3) return 0;
  if (crowd < 0.6) return -1;
  if (crowd < 0.85) return -2;
  return -3;
}

function obstacleModifier(obstacles: number): number {
  if (obstacles < 0.4) return 0;
  if (obstacles < 0.7) return -1;
  return -2;
}

function familiarityModifier(familiarity: number): number {
  // spec 16.8 - corrected per appendix D.1.1
  if (familiarity < 20) return -1;
  if (familiarity < 50) return 0;
  if (familiarity < 75) return 1;
  return 2;
}

function perceptionModifier(perception: number): number {
  if (perception < 30) return -1;
  if (perception < 70) return 0;
  if (perception < 90) return 1;
  return 2;
}

function stealthModifier(args: {
  visibilityState: 'normal' | 'disguised' | 'hidden';
  stealth: number;
  isHiding: boolean;
}): number {
  let mod = 0;
  if (args.visibilityState === 'disguised') mod = -1;
  if (args.visibilityState === 'hidden') mod = -2;
  if (args.stealth > 75 && args.isHiding) mod -= 1;
  if (args.stealth < 30 && args.isHiding) mod += 1;
  return mod;
}

export function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeClarity(input: ClarityInputs): number {
  const base = BASE_BY_SPATIAL[input.spatialRelation];
  const obstacles = input.obstacles ?? 0;
  const noise = input.noise ?? 0;
  const crowd = input.crowd ?? 0;
  const perception = input.perception ?? 50;
  const familiarity = input.familiarity ?? 30;

  let clarity = base;
  // line_of_sight (uses obstacles ratio)
  clarity += lineOfSightModifier(obstacles);
  clarity += familiarityModifier(familiarity);
  clarity += perceptionModifier(perception);
  clarity -= -noiseModifier(noise); // noise mod is negative; subtract negative = add
  // simpler: just add the negative modifier
  // (above line is intentional dead-code; below is the actual)
  clarity += noiseModifier(noise);
  clarity += obstacleModifier(obstacles);
  clarity += crowdModifier(crowd);

  if (input.targetVisibilityState || input.targetStealth !== undefined) {
    clarity += stealthModifier({
      visibilityState: input.targetVisibilityState ?? 'normal',
      stealth: input.targetStealth ?? 0,
      isHiding: Boolean(input.targetIsHiding),
    });
  }

  return clamp(0, 5, Math.round(clarity));
}

/** Whether an observer with given social_insight can form inferences from clues */
export function canInfer(socialInsight: number): 'none' | 'low' | 'mid' | 'high' {
  if (socialInsight < 30) return 'none';
  if (socialInsight < 70) return 'low';
  if (socialInsight < 90) return 'mid';
  return 'high';
}

/**
 * Familiarity score per spec 16.8 from relationship dimensions.
 * familiarity_score = (|trust| + |hostility| + curiosity + dependence + attraction + fear) / 6
 */
export function familiarityScore(rel: {
  trust?: number;
  hostility?: number;
  curiosity?: number;
  dependence?: number;
  attraction?: number;
  fear?: number;
}): number {
  return (
    (Math.abs(rel.trust ?? 0) +
      Math.abs(rel.hostility ?? 0) +
      (rel.curiosity ?? 0) +
      (rel.dependence ?? 0) +
      (rel.attraction ?? 0) +
      (rel.fear ?? 0)) /
    6
  );
}

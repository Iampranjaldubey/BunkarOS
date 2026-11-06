// SPEC-M18 §8: the screens ask the organisation's pack for its words, lists, art and signature.
import { useEffect } from 'react';
import { setPackWords } from '../i18n';
import { GuardBorder } from '../components/carpet/Carpet';
import { RugArt } from '../components/carpet/RugArt';
import { BagArt, StitchLine } from './bags/art';
import { usePack } from './usePack';
import { cn } from '../lib/utils';

/** Keeps the i18n pack words in step with the organisation's industry. Rendered once, near the root. */
export function PackBridge() {
  const pack = usePack();
  useEffect(() => { setPackWords(pack.id, pack.words); }, [pack]);
  return null;
}

/** The industry's signature detail (carpet: knotted border band; bags: running stitch). */
export function Signature({ className, tone, industry }: { className?: string; tone?: 'dye' | 'ink'; industry?: string }) {
  const pack = usePack();
  return (industry ?? pack.id) === 'bags' ? <StitchLine className={className} tone={tone} /> : <GuardBorder className={className} tone={tone} />;
}

/** A product drawn in code when there is no photo: a rug for carpet, a bag for bags. */
export function ProductArt(props: { design: string; length?: number; width?: number; seed?: string; weave?: boolean; floor?: boolean; className?: string; label?: string; fabric?: string }) {
  const pack = usePack();
  if (pack.id === 'bags') return <BagArt design={props.design} seed={props.seed} className={cn(props.className, props.weave && 'rise-in')} label={props.label} floor={props.floor} fabric={props.fabric} />;
  return <RugArt {...props} />;
}

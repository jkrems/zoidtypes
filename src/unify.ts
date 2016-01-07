import { Type, TypeConstraint, TypeVariable, TemplateTypeInstance, TypeUnion } from './types';
import { clone, unseal } from './clone';

/* BEGIN: ES6 Map */
interface Map<K, V> {
    clear(): void;
    delete(key: K): boolean;
    forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void, thisArg?: any): void;
    get(key: K): V;
    has(key: K): boolean;
    set(key: K, value?: V): Map<K, V>;
    size: number;
}

interface MapConstructor {
    new (): Map<any, any>;
    new <K, V>(): Map<K, V>;
    prototype: Map<any, any>;
}
declare var Map: MapConstructor;
/* END: ES6 Map */

function specificScore(type) {
  function countVariables(sum, t) {
    t = t.actual;
    if (t instanceof TypeConstraint || t instanceof TypeVariable) {
      return sum;
    } else if (t instanceof TemplateTypeInstance) {
      return t.args.reduce(countVariables, sum + 1);
    } else {
      return sum + 1;
    }
  }
  return countVariables(0, type);
}

function unifyUnion(union: TypeUnion, b: Type): Type {
  if (b instanceof TypeVariable) {
    b.actual = union;
    return union;
  }

  const candidates = union.types
    .map(t => {
      // Basically: how many placeholders does the type have?
      return { raw: t, type: unseal(t), score: specificScore(t) };
    })
    .filter(c => {
      try {
        unify(c.type, clone(b));
        return true;
      } catch (undefined) {
        return false;
      }
    })
    .sort((a, b) => b.score - a.score);

  if (candidates.length < 1) {
    throw new Error(`No match for ${b} in ${union}`);
  } else if (candidates.length > 1) {
    // If the first is more specific than the rest,
    // accept the first.
    if (candidates[0].score > candidates[1].score) {
      candidates.splice(1);
    } else {
      throw new Error(`Ambiguous ${b} for ${union}`);
    }
  }
  return unify(candidates[0].type, b);
}

export function unify(a: Type, b: Type): Type {
  a = a.actual;
  b = b.actual;

  if (a instanceof TypeVariable) {
    a.actual = b;
    return b;
  } else if (b instanceof TypeVariable) {
    b.actual = a;
    return a;
  }

  if (a instanceof TypeUnion) {
    return unifyUnion(a, b);
  } else if (b instanceof TypeUnion) {
    return unify(b, a);
  }

  // Simple case - it's the same thing.
  // This covers TerminalTypes.
  if (a === b) {
    return a;
  }

  if (!(a instanceof TemplateTypeInstance &&
        b instanceof TemplateTypeInstance)) {
    throw new Error(`Incompatible types: ${a} and ${b}`);
  }

  const aT = <TemplateTypeInstance>a;
  const bT = <TemplateTypeInstance>b;

  if (aT.template !== bT.template) {
    throw new Error(`Incompatible types: ${a} and ${b}`);
  }

  aT.args.forEach((arg, idx) => {
    unify(arg, bT.args[idx]);
  });

  return a;
}

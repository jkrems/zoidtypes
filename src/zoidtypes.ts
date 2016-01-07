import { Type, NamedType, TypeVariable, TypeConstraint, TypeTerminal, TemplateType, TemplateTypeInstance, FUNCTION, TypeUnion } from './types';
import { unify } from './unify';
import { unseal } from './clone';
import { Scope } from './scope';

export { unify } from './unify';
export { seal, unseal } from './clone';

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

export function createScope(): Scope {
  return new Scope();
}

export function createVariable(name): TypeVariable {
  return new TypeVariable(name);
}

export function createConstraint(name): TypeConstraint {
  return new TypeConstraint(name);
}

export function unifyCall(a, args, result) {
  args = args.slice(0);
  let b = FUNCTION.create([args.pop(), result]);
  while (args.length) {
    b = FUNCTION.create([args.pop(), b]);
  }
  return unify(unseal(a), b);
}

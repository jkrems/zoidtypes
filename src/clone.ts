import { Type, TypeConstraint, TypeVariable, TemplateTypeInstance, TypeUnion } from './types';

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

function id<T>(x: T): T { return x; }
function baseClone(type: Type, onVariable = id, onConstraint = id): Type {
  const lookup = new Map<Type, Type>();
  function transform(x) {
    x = x.actual;
    if (x instanceof TypeConstraint) {
      if (!lookup.has(x)) {
        lookup.set(x, onConstraint(x));
      }
      return lookup.get(x);
    } else if (x instanceof TypeVariable) {
      if (!lookup.has(x)) {
        lookup.set(x, onVariable(x));
      }
      return lookup.get(x);
    } else if (x instanceof TemplateTypeInstance) {
      return new TemplateTypeInstance(x.template, x.args.map(transform));
    }
    return x;
  }

  return transform(type);
}

export function clone(type: Type): Type {
  return baseClone(type,
    v => new TypeVariable(v.name),
    c => new TypeConstraint(c.name));
}

export function seal(type: Type): Type {
  // Replace variables in type with constraints.
  // This means that future usage of the type (e.g. when calling a function)
  // will not try to narrow them down but only check against them.
  return baseClone(type, v => new TypeConstraint(v.name), id);
}

export function unseal(type: Type): Type {
  return baseClone(type,
    id, c => new TypeVariable(c.name));
}

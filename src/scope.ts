import { Type, NamedType, TypeVariable, TypeConstraint, TypeTerminal, TemplateType, TemplateTypeInstance, FUNCTION, TypeUnion } from './types';

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

export class Scope {
  parent: Scope;
  known: Map<string, Type | TemplateType>;

  constructor(parent = null) {
    this.parent = parent;
    this.known = new Map();
  }

  createFunctionType(args: Type[], result: Type): TemplateTypeInstance {
    args = args.slice(0);
    let current = FUNCTION.create([ args.pop(), result ]);
    while (args.length) {
      current = FUNCTION.create([ args.pop(), current ]);
    }
    return current;
  }

  createUnion(types: Type[]): TypeUnion {
    return new TypeUnion(types);
  }

  register(type: NamedType): NamedType {
    if (typeof type.name !== 'string') {
      throw new Error(`Could not find .name property of ${type}`);
    }
    return this.set(type.name, type);
  }

  registerTerminal(name): TypeTerminal {
    if (this.known.has(name)) {
      return <TypeTerminal>this.known.get(name);
    }
    return <TypeTerminal>this.set(name, new TypeTerminal(name));
  }

  registerTemplate(name, constraints): TemplateType {
    if (this.known.has(name)) {
      return <TemplateType>this.known.get(name);
    }
    return this.set(name, new TemplateType(name, constraints));
  }

  set<T extends Type | TemplateType>(key: string, value: T): T {
    this.known.set(key, value);
    return value;
  }

  get(key: string): Type | TemplateType {
    if (this.known.has(key)) {
      return this.known.get(key);
    } else if (this.parent !== null) {
      return this.parent.get(key);
    } else {
      throw new Error(`Not defined: ${key}`);
    }
  }

  has(key: string): boolean {
    return this.known.has(key) || (this.parent !== null && this.parent.has(key));
  }

  createChild(): Scope {
    return new Scope(this);
  }
}

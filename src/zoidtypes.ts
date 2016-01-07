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

interface Type {
  actual: Type;

  toString(unknowns: Map<Type, string>);
}

interface NamedType extends Type {
  name: string;
}

class TypeTerminal implements NamedType {
  name: string;

  constructor(name) {
    this.name = name;
  }

  get actual() { return this; }

  toString() { return this.name; }
}

class TypeUnion implements Type {
  types: Type[];

  constructor(types) {
    this.types = types;
  }

  get actual() { return this; }

  toString(unknowns = new Map()) {
    const typeList = this.types.map(t => t.toString(unknowns));
    return `{${typeList.join('|')}}`;
  }
}

class TypeVariable implements NamedType {
  name: string;
  private _actual: Type;

  constructor(name) {
    this.name = name || null;
    this._actual = null;
  }

  get actual(): Type {
    return (this._actual && this._actual.actual) || this;
  }

  set actual(actual) {
    this._actual = actual;
  }

  toString(unknowns = new Map()) {
    if (this._actual !== null) {
      return this.actual.toString(unknowns);
    }

    if (!unknowns.has(this)) {
      unknowns.set(this, `'${this.name || unknowns.size}`);
    }
    return unknowns.get(this);
  }
}

class TypeConstraint implements NamedType {
  name: string;

  constructor(name = null) {
    this.name = name;
  }

  get actual() { return this; }

  toString(unknowns = new Map<Type, string>()) {
    if (!unknowns.has(this)) {
      unknowns.set(this, `'${unknowns.size}`);
    }
    return unknowns.get(this);
  }
}

class TemplateType {
  name: string;
  constraints;
  params: string[];

  constructor(name, constraints) {
    this.name = name;
    if (Array.isArray(constraints)) {
      if (constraints.length !== 1) {
        throw new Error('Better logic still needed');
      }
      constraints = constraints.reduce((out, key) => {
        out[key] = new TypeConstraint();
        return out;
      }, {});
    }
    this.params = Object.keys(constraints);
    this.constraints = constraints;
  }

  format(args: Type[], unknowns: Map<Type, string> = new Map()) {
    const argList = args.map(arg => arg.toString(unknowns));
    return `${this.name}<${argList.join(', ')}>`;
  }

  create(args: Type[]) {
    return new TemplateTypeInstance(this, args);
  }
}

class TemplateTypeInstance {
  template: TemplateType;
  args: Type[];

  constructor(template: TemplateType, args: Type[]) {
    this.template = template;
    this.args = args;
  }

  get actual() { return this; }

  toString(unknowns) {
    return this.template.format(this.args, unknowns);
  }
}

const FUNCTION = new TemplateType('Function', {
  Input: new TypeConstraint(),
  Output: new TypeConstraint(),
});

FUNCTION.format = function formatFunction(rawArgs, unknowns) {
  unknowns = unknowns || new Map();

  const args = [ rawArgs[0] ];
  let result = rawArgs[1];
  while ((<TemplateTypeInstance>result).template === FUNCTION) {
    const tArgs = (<TemplateTypeInstance>result).args;
    args.push(tArgs[0]);
    result = tArgs[1];
  }
  const argList = args.map(arg => arg.toString(unknowns)).join(', ');
  return `(${argList}) -> ${result.toString(unknowns)}`;
};

class Scope {
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

export function createScope(): Scope {
  return new Scope();
}

export function createVariable(name): TypeVariable {
  return new TypeVariable(name);
}

export function createConstraint(name): TypeConstraint {
  return new TypeConstraint(name);
}

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

function clone(type: Type): Type {
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

export function unifyCall(a, args, result) {
  args = args.slice(0);
  let b = FUNCTION.create([args.pop(), result]);
  while (args.length) {
    b = FUNCTION.create([args.pop(), b]);
  }
  return unify(unseal(a), b);
}

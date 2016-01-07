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

export interface Type {
  actual: Type;

  toString(unknowns: Map<Type, string>);
}

export interface NamedType extends Type {
  name: string;
}

export class TypeTerminal implements NamedType {
  name: string;

  constructor(name) {
    this.name = name;
  }

  get actual() { return this; }

  toString() { return this.name; }
}

export class TypeUnion implements Type {
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

export class TypeVariable implements NamedType {
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

export class TypeConstraint implements NamedType {
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

export class TemplateType {
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

export class TemplateTypeInstance {
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

export const FUNCTION = new TemplateType('Function', {
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

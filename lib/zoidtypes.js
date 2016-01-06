'use strict';

// TypeTag = { TypeConstraint | TypeTerminal | TemplateTypeInstance }

class TypeTerminal {
  constructor(name) {
    this.name = name;
  }

  toString() {
    return this.name;
  }
}

class TypeConstraint {
  toString(unknowns) {
    unknowns = unknowns || new Map();
    if (!unknowns.has(this)) {
      unknowns.set(this, `'${unknowns.size}`);
    }
    return unknowns.get(this);
  }
}

class TemplateType {
  constructor(name, constraints) {
    this.name = name;
    this.params = Object.keys(constraints);
    this.constraints = constraints;
  }

  create(args) {
    return new TemplateTypeInstance(this, args);
  }
}

class FunctionType extends TemplateType {
  constructor(constraints) {
    super('Function', constraints);
  }

  create(args) {
    return new FunctionInstance(this, args);
  }
}

class TemplateTypeInstance {
  constructor(template, args) {
    this.template = template;
    this.args = args;
  }

  toString(unknowns) {
    unknowns = unknowns || new Map();
    const argList = this.args.map(arg => arg.toString(unknowns)).join(', ');
    return `${this.template.name}<${argList}>`;
  }
}

class FunctionInstance extends TemplateTypeInstance {
  toString(unknowns) {
    unknowns = unknowns || new Map();

    const args = [ this.args[0] ];
    let result = this.args[1];
    while (result instanceof FunctionInstance) {
      args.push(result.args[0]);
      result = result.args[1];
    }
    const argList = args.map(arg => arg.toString(unknowns)).join(', ');
    return `(${argList}) -> ${result.toString(unknowns)}`;
  }
}

// template <n: Int32>
class Vector {
  constructor(components) {
    this.components = components;
    this.n = components.length;
  }

  get length() {
    return Math.sqrt(this.components.reduce((sum, component) => {
      return sum + component * component;
    }));
  }
}

class Scope {
  constructor(parent) {
    this.parent = parent || null;
    this.known = new Map();
  }

  register(type) {
    if (typeof type.name !== 'string') {
      throw new Error(`Could not find .name property of ${type}`);
    }
    return this.set(type.name, type);
  }

  set(key, value) {
    this.known.set(key, value);
    return value;
  }

  get(key) {
    if (this.known.has(key)) {
      return this.known.get(key);
    } else if (this.parent !== null) {
      return this.parent.get(key);
    } else {
      throw new Error(`Not defined: ${key}`);
    }
  }

  has(key) {
    return this.known.has(key) || (this.parent !== null && this.parent.has(key));
  }

  createChild() {
    return new Scope(this);
  }
}

function createBuiltIns() {
  const scope = new Scope();

  const Type = scope.register(new TypeTerminal('Type'));

  const Int32 = scope.register(new TypeTerminal('Int32'));

  const Function = scope.register(new FunctionType({
    Input: new TypeConstraint(Type),
    Output: new TypeConstraint(Type),
  }));

  const List = scope.register(new TemplateType('List', {
    T: new TypeConstraint(Type),
  }));

  const Promise = scope.register(new TemplateType('Promise', {
    T: new TypeConstraint(Type),
  }));

  const Tuple = scope.register(new TemplateType('Tuple', {
    Left: new TypeConstraint(Type),
    Right: new TypeConstraint(Type),
  }));

  const f = {
    type: Function.create([
      Int32, Function.create([Int32, Int32])
    ]),
  };
  console.log('f: %s ', f.type);

  const a = new TypeConstraint(Type);
  const b = new TypeConstraint(Type);
  const genericF = {
    type: Function.create([
      a, Function.create([b, Promise.create([Tuple.create([a, b])])]),
    ]),
  };
  console.log('genericF: %s', genericF.type);

  const asyncList = {
    type: Promise.create([
      List.create([Int32]),
    ]),
  };
  console.log('asyncList: %s', asyncList.type);

  return scope;
}
console.log(createBuiltIns());

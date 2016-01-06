'use strict';

// TypeTag = { TypeConstraint | TypeTerminal | TemplateTypeInstance }

class TypeTerminal {
  constructor(name) {
    this.name = name;
  }

  get actual() { return this; }

  toString() {
    return this.name;
  }
}

class TypeVariable {
  constructor(name) {
    this.name = name || null;
    this._actual = null;
  }

  get actual() {
    return (this._actual && this._actual.actual) || this;
  }

  set actual(actual) {
    this._actual = actual;
  }

  toString(unknowns) {
    if (this._actual !== null) {
      return this.actual.toString(unknowns);
    }

    unknowns = unknowns || new Map();
    if (!unknowns.has(this)) {
      unknowns.set(this, `'${this.name || unknowns.size}`);
    }
    return unknowns.get(this);
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

  get actual() { return this; }

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

  registerTerminal(name) {
    if (this.known.has(name)) {
      return this.known.get(name);
    }
    return this.set(name, new TypeTerminal(name));
  }

  registerTemplate(name, constraints) {
    if (this.known.has(name)) {
      return this.known.get(name);
    }
    return this.set(name, new TemplateType(name, constraints));
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
exports.createBuiltIns = createBuiltIns;

function createScope() {
  return new Scope();
}
exports.createScope = createScope;

function createVariable(name) {
  return new TypeVariable(name);
}
exports.createVariable = createVariable;

function unify(a, b) {
  a = a.actual;
  b = b.actual;

  if (a instanceof TypeVariable) {
    a.actual = b;
    return b;
  } else if (b instanceof TypeVariable) {
    b.actual = a;
    return a;
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

  if (a.template !== b.template) {
    throw new Error(`Incompatible types: ${a} and ${b}`);
  }

  a.args.forEach((arg, idx) => {
    unify(arg, b.args[idx]);
  });

  return a;
}
exports.unify = unify;

// Interesting function:
// template<Wrap>
// wrapAndZip(wrap: <T>(T)=>Wrap<T>,
//            zip: <T, U>(Wrap<T>, Wrap<U>)=>Wrap<Tuple<T, U>>): Wrap<Tuple<Int32, String>> {
//   return zip(wrap(10), wrap("abc"))
// }

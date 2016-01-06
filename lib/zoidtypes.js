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
  constructor(name) {
    this.name = name || null;
  }

  get actual() { return this; }

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
const FUNCTION = new FunctionType({
  Input: new TypeConstraint(),
  Output: new TypeConstraint(),
});

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
  seal() {
    // Replace variables in the signature with constraints.
    // This means that future usage of the function (e.g. when calling)
    // will not try to narrow them down but only check against them.
    const lookup = new Map();
    function replaceMutables(x) {
      x = x.actual;
      if (x instanceof TypeVariable) {
        if (!lookup.has(x)) {
          lookup.set(x, new TypeConstraint(x.name));
        }
        return lookup.get(x);
      } else if (x instanceof FunctionInstance) {
        return new FunctionInstance(x.template, x.args.map(replaceMutables));
      } else if (x instanceof TemplateTypeInstance) {
        return new TemplateTypeInstance(x.template, x.args.map(replaceMutables));
      }
      return x;
    }
    return replaceMutables(this);
  }

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

  createFunctionType(args, result) {
    args = args.slice(0);
    let current = FUNCTION.create([ args.pop(), result ]);
    while (args.length) {
      current = FUNCTION.create([ args.pop(), current ]);
    }
    return current;
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
    Input: new TypeConstraint(),
    Output: new TypeConstraint(),
  }));

  const List = scope.register(new TemplateType('List', {
    T: new TypeConstraint(),
  }));

  const Promise = scope.register(new TemplateType('Promise', {
    T: new TypeConstraint(),
  }));

  const Tuple = scope.register(new TemplateType('Tuple', {
    Left: new TypeConstraint(),
    Right: new TypeConstraint(),
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

function createConstraint(name) {
  return new TypeConstraint(name);
}
exports.createConstraint = createConstraint;

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

function replaceImmutables(t) {
  const lookup = new Map();
  function mapVariable(x) {
    x = x.actual;
    if (x instanceof TypeConstraint) {
      if (!lookup.has(x)) {
        lookup.set(x, new TypeVariable(x.name));
      }
      return lookup.get(x);
    } else if (x instanceof FunctionInstance) {
      return new FunctionInstance(x.template, x.args.map(mapVariable));
    } else if (x instanceof TemplateTypeInstance) {
      return new TemplateTypeInstance(x.template, x.args.map(mapVariable));
    }
    return x;
  }

  return mapVariable(t);
}

function unifyCall(a, args, result) {
  args = args.slice(0);
  let b = FUNCTION.create([args.pop(), result]);
  while (args.length) {
    b = FUNCTION.create([args.pop(), b]);
  }
  return unify(replaceImmutables(a), b);
}
exports.unifyCall = unifyCall;

// Interesting function:
// template<Wrap>
// wrapAndZip(wrap: <T>(T)=>Wrap<T>,
//            zip: <T, U>(Wrap<T>, Wrap<U>)=>Wrap<Tuple<T, U>>): Wrap<Tuple<Int32, String>> {
//   return zip(wrap(10), wrap("abc"))
// }

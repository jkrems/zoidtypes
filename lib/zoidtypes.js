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

class TypeUnion {
  constructor(types) {
    this.types = types;
  }

  get actual() { return this; }

  toString(unknowns) {
    unknowns = unknowns || new Map();
    const typeList = this.types.map(t => t.toString(unknowns));
    return `{${typeList.join('|')}}`;
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

  format(args, unknowns) {
    unknowns = unknowns || new Map();
    const argList = args.map(arg => arg.toString(unknowns)).join(', ');
    return `${this.name}<${argList}>`;
  }

  create(args) {
    return new TemplateTypeInstance(this, args);
  }
}

class TemplateTypeInstance {
  constructor(template, args) {
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
  while (result.template === FUNCTION) {
    args.push(result.args[0]);
    result = result.args[1];
  }
  const argList = args.map(arg => arg.toString(unknowns)).join(', ');
  return `(${argList}) -> ${result.toString(unknowns)}`;
};

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

  createUnion(types) {
    return new TypeUnion(types);
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

function id(x) { return x; }

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

function baseClone(type, onVariable, onConstraint) {
  const lookup = new Map();
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

function clone(type) {
  return baseClone(type,
    v => new TypeVariable(v.name),
    c => new TypeConstraint(c.name));
}

function unifyUnion(union, b) {
  if (b instanceof TypeVariable) {
    b.actual = union;
    return union;
  }

  const candidates = union.types
    .map(t => {
      // Basically: how many placeholders does the type have?
      return { raw: t, type: replaceImmutables(t), score: specificScore(t) };
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

  if (a.template !== b.template) {
    throw new Error(`Incompatible types: ${a} and ${b}`);
  }

  a.args.forEach((arg, idx) => {
    unify(arg, b.args[idx]);
  });

  return a;
}
exports.unify = unify;

function replaceImmutables(type) {
  return baseClone(type,
    id, c => new TypeVariable(c.name));
}
exports.unseal = replaceImmutables;

function unifyCall(a, args, result) {
  args = args.slice(0);
  let b = FUNCTION.create([args.pop(), result]);
  while (args.length) {
    b = FUNCTION.create([args.pop(), b]);
  }
  return unify(replaceImmutables(a), b);
}
exports.unifyCall = unifyCall;

function seal(type) {
  // Replace variables in type with constraints.
  // This means that future usage of the type (e.g. when calling a function)
  // will not try to narrow them down but only check against them.
  return baseClone(type, v => new TypeConstraint(v.name), id);
}
exports.seal = seal;

// Interesting function:
// template<Wrap>
// wrapAndZip(wrap: <T>(T)=>Wrap<T>,
//            zip: <T, U>(Wrap<T>, Wrap<U>)=>Wrap<Tuple<T, U>>): Wrap<Tuple<Int32, String>> {
//   return zip(wrap(10), wrap("abc"))
// }

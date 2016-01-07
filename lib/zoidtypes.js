var TypeTerminal = (function () {
    function TypeTerminal(name) {
        this.name = name;
    }
    Object.defineProperty(TypeTerminal.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeTerminal.prototype.toString = function () { return this.name; };
    return TypeTerminal;
})();
var TypeUnion = (function () {
    function TypeUnion(types) {
        this.types = types;
    }
    Object.defineProperty(TypeUnion.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeUnion.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        var typeList = this.types.map(function (t) { return t.toString(unknowns); });
        return "{" + typeList.join('|') + "}";
    };
    return TypeUnion;
})();
var TypeVariable = (function () {
    function TypeVariable(name) {
        this.name = name || null;
        this._actual = null;
    }
    Object.defineProperty(TypeVariable.prototype, "actual", {
        get: function () {
            return (this._actual && this._actual.actual) || this;
        },
        set: function (actual) {
            this._actual = actual;
        },
        enumerable: true,
        configurable: true
    });
    TypeVariable.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        if (this._actual !== null) {
            return this.actual.toString(unknowns);
        }
        if (!unknowns.has(this)) {
            unknowns.set(this, "'" + (this.name || unknowns.size));
        }
        return unknowns.get(this);
    };
    return TypeVariable;
})();
var TypeConstraint = (function () {
    function TypeConstraint(name) {
        if (name === void 0) { name = null; }
        this.name = name;
    }
    Object.defineProperty(TypeConstraint.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeConstraint.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        if (!unknowns.has(this)) {
            unknowns.set(this, "'" + unknowns.size);
        }
        return unknowns.get(this);
    };
    return TypeConstraint;
})();
var TemplateType = (function () {
    function TemplateType(name, constraints) {
        this.name = name;
        if (Array.isArray(constraints)) {
            if (constraints.length !== 1) {
                throw new Error('Better logic still needed');
            }
            constraints = constraints.reduce(function (out, key) {
                out[key] = new TypeConstraint();
                return out;
            }, {});
        }
        this.params = Object.keys(constraints);
        this.constraints = constraints;
    }
    TemplateType.prototype.format = function (args, unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        var argList = args.map(function (arg) { return arg.toString(unknowns); });
        return this.name + "<" + argList.join(', ') + ">";
    };
    TemplateType.prototype.create = function (args) {
        return new TemplateTypeInstance(this, args);
    };
    return TemplateType;
})();
var TemplateTypeInstance = (function () {
    function TemplateTypeInstance(template, args) {
        this.template = template;
        this.args = args;
    }
    Object.defineProperty(TemplateTypeInstance.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TemplateTypeInstance.prototype.toString = function (unknowns) {
        return this.template.format(this.args, unknowns);
    };
    return TemplateTypeInstance;
})();
var FUNCTION = new TemplateType('Function', {
    Input: new TypeConstraint(),
    Output: new TypeConstraint(),
});
FUNCTION.format = function formatFunction(rawArgs, unknowns) {
    unknowns = unknowns || new Map();
    var args = [rawArgs[0]];
    var result = rawArgs[1];
    while (result.template === FUNCTION) {
        var tArgs = result.args;
        args.push(tArgs[0]);
        result = tArgs[1];
    }
    var argList = args.map(function (arg) { return arg.toString(unknowns); }).join(', ');
    return "(" + argList + ") -> " + result.toString(unknowns);
};
var Scope = (function () {
    function Scope(parent) {
        if (parent === void 0) { parent = null; }
        this.parent = parent;
        this.known = new Map();
    }
    Scope.prototype.createFunctionType = function (args, result) {
        args = args.slice(0);
        var current = FUNCTION.create([args.pop(), result]);
        while (args.length) {
            current = FUNCTION.create([args.pop(), current]);
        }
        return current;
    };
    Scope.prototype.createUnion = function (types) {
        return new TypeUnion(types);
    };
    Scope.prototype.register = function (type) {
        if (typeof type.name !== 'string') {
            throw new Error("Could not find .name property of " + type);
        }
        return this.set(type.name, type);
    };
    Scope.prototype.registerTerminal = function (name) {
        if (this.known.has(name)) {
            return this.known.get(name);
        }
        return this.set(name, new TypeTerminal(name));
    };
    Scope.prototype.registerTemplate = function (name, constraints) {
        if (this.known.has(name)) {
            return this.known.get(name);
        }
        return this.set(name, new TemplateType(name, constraints));
    };
    Scope.prototype.set = function (key, value) {
        this.known.set(key, value);
        return value;
    };
    Scope.prototype.get = function (key) {
        if (this.known.has(key)) {
            return this.known.get(key);
        }
        else if (this.parent !== null) {
            return this.parent.get(key);
        }
        else {
            throw new Error("Not defined: " + key);
        }
    };
    Scope.prototype.has = function (key) {
        return this.known.has(key) || (this.parent !== null && this.parent.has(key));
    };
    Scope.prototype.createChild = function () {
        return new Scope(this);
    };
    return Scope;
})();
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
function specificScore(type) {
    function countVariables(sum, t) {
        t = t.actual;
        if (t instanceof TypeConstraint || t instanceof TypeVariable) {
            return sum;
        }
        else if (t instanceof TemplateTypeInstance) {
            return t.args.reduce(countVariables, sum + 1);
        }
        else {
            return sum + 1;
        }
    }
    return countVariables(0, type);
}
function id(x) { return x; }
function baseClone(type, onVariable, onConstraint) {
    if (onVariable === void 0) { onVariable = id; }
    if (onConstraint === void 0) { onConstraint = id; }
    var lookup = new Map();
    function transform(x) {
        x = x.actual;
        if (x instanceof TypeConstraint) {
            if (!lookup.has(x)) {
                lookup.set(x, onConstraint(x));
            }
            return lookup.get(x);
        }
        else if (x instanceof TypeVariable) {
            if (!lookup.has(x)) {
                lookup.set(x, onVariable(x));
            }
            return lookup.get(x);
        }
        else if (x instanceof TemplateTypeInstance) {
            return new TemplateTypeInstance(x.template, x.args.map(transform));
        }
        return x;
    }
    return transform(type);
}
function clone(type) {
    return baseClone(type, function (v) { return new TypeVariable(v.name); }, function (c) { return new TypeConstraint(c.name); });
}
function seal(type) {
    // Replace variables in type with constraints.
    // This means that future usage of the type (e.g. when calling a function)
    // will not try to narrow them down but only check against them.
    return baseClone(type, function (v) { return new TypeConstraint(v.name); }, id);
}
exports.seal = seal;
function unseal(type) {
    return baseClone(type, id, function (c) { return new TypeVariable(c.name); });
}
exports.unseal = unseal;
function unifyUnion(union, b) {
    if (b instanceof TypeVariable) {
        b.actual = union;
        return union;
    }
    var candidates = union.types
        .map(function (t) {
        // Basically: how many placeholders does the type have?
        return { raw: t, type: unseal(t), score: specificScore(t) };
    })
        .filter(function (c) {
        try {
            unify(c.type, clone(b));
            return true;
        }
        catch (undefined) {
            return false;
        }
    })
        .sort(function (a, b) { return b.score - a.score; });
    if (candidates.length < 1) {
        throw new Error("No match for " + b + " in " + union);
    }
    else if (candidates.length > 1) {
        // If the first is more specific than the rest,
        // accept the first.
        if (candidates[0].score > candidates[1].score) {
            candidates.splice(1);
        }
        else {
            throw new Error("Ambiguous " + b + " for " + union);
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
    }
    else if (b instanceof TypeVariable) {
        b.actual = a;
        return a;
    }
    if (a instanceof TypeUnion) {
        return unifyUnion(a, b);
    }
    else if (b instanceof TypeUnion) {
        return unify(b, a);
    }
    // Simple case - it's the same thing.
    // This covers TerminalTypes.
    if (a === b) {
        return a;
    }
    if (!(a instanceof TemplateTypeInstance &&
        b instanceof TemplateTypeInstance)) {
        throw new Error("Incompatible types: " + a + " and " + b);
    }
    var aT = a;
    var bT = b;
    if (aT.template !== bT.template) {
        throw new Error("Incompatible types: " + a + " and " + b);
    }
    aT.args.forEach(function (arg, idx) {
        unify(arg, bT.args[idx]);
    });
    return a;
}
exports.unify = unify;
function unifyCall(a, args, result) {
    args = args.slice(0);
    var b = FUNCTION.create([args.pop(), result]);
    while (args.length) {
        b = FUNCTION.create([args.pop(), b]);
    }
    return unify(unseal(a), b);
}
exports.unifyCall = unifyCall;

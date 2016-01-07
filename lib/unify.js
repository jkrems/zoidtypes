var types_1 = require('./types');
var clone_1 = require('./clone');
/* END: ES6 Map */
function specificScore(type) {
    function countVariables(sum, t) {
        t = t.actual;
        if (t instanceof types_1.TypeConstraint || t instanceof types_1.TypeVariable) {
            return sum;
        }
        else if (t instanceof types_1.TemplateTypeInstance) {
            return t.args.reduce(countVariables, sum + 1);
        }
        else {
            return sum + 1;
        }
    }
    return countVariables(0, type);
}
function unifyUnion(union, b) {
    if (b instanceof types_1.TypeVariable) {
        b.actual = union;
        return union;
    }
    var candidates = union.types
        .map(function (t) {
        // Basically: how many placeholders does the type have?
        return { raw: t, type: clone_1.unseal(t), score: specificScore(t) };
    })
        .filter(function (c) {
        try {
            unify(c.type, clone_1.clone(b));
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
    if (a instanceof types_1.TypeVariable) {
        a.actual = b;
        return b;
    }
    else if (b instanceof types_1.TypeVariable) {
        b.actual = a;
        return a;
    }
    if (a instanceof types_1.TypeUnion) {
        return unifyUnion(a, b);
    }
    else if (b instanceof types_1.TypeUnion) {
        return unify(b, a);
    }
    // Simple case - it's the same thing.
    // This covers TerminalTypes.
    if (a === b) {
        return a;
    }
    if (!(a instanceof types_1.TemplateTypeInstance &&
        b instanceof types_1.TemplateTypeInstance)) {
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

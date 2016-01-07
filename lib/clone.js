var types_1 = require('./types');
/* END: ES6 Map */
function id(x) { return x; }
function baseClone(type, onVariable, onConstraint) {
    if (onVariable === void 0) { onVariable = id; }
    if (onConstraint === void 0) { onConstraint = id; }
    var lookup = new Map();
    function transform(x) {
        x = x.actual;
        if (x instanceof types_1.TypeConstraint) {
            if (!lookup.has(x)) {
                lookup.set(x, onConstraint(x));
            }
            return lookup.get(x);
        }
        else if (x instanceof types_1.TypeVariable) {
            if (!lookup.has(x)) {
                lookup.set(x, onVariable(x));
            }
            return lookup.get(x);
        }
        else if (x instanceof types_1.TemplateTypeInstance) {
            return new types_1.TemplateTypeInstance(x.template, x.args.map(transform));
        }
        return x;
    }
    return transform(type);
}
function clone(type) {
    return baseClone(type, function (v) { return new types_1.TypeVariable(v.name); }, function (c) { return new types_1.TypeConstraint(c.name); });
}
exports.clone = clone;
function seal(type) {
    // Replace variables in type with constraints.
    // This means that future usage of the type (e.g. when calling a function)
    // will not try to narrow them down but only check against them.
    return baseClone(type, function (v) { return new types_1.TypeConstraint(v.name); }, id);
}
exports.seal = seal;
function unseal(type) {
    return baseClone(type, id, function (c) { return new types_1.TypeVariable(c.name); });
}
exports.unseal = unseal;

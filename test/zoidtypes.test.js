'use strict';
const test = require('tap').test;

const Types = require('../');

const createScope = Types.createScope;
const seal = Types.seal;

test('Unify terminal and variable', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const a = Types.createVariable('a');
  Types.unify(a, Int32);
  t.equal(a.actual, Int32.actual);

  const b = Types.createVariable('b');
  Types.unify(a, b);
  t.equal(b.actual, Int32.actual);
  t.equal(b.actual, a.actual);

  // Can unify again and it just does nothing.
  Types.unify(a, b);

  t.end();
});

test('Unify template and terminal', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const List = scope.registerTemplate('List', [ 'T' ]);
  const ListInt32 = List.create([Int32]);

  t.throws(() => Types.unify(ListInt32, Int32));
  t.end();
});

test('Unify template type instances', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const List = scope.registerTemplate('List', [ 'T' ]);
  const a = Types.createVariable('a');

  const ListA = List.create([a]);
  const ListInt32 = List.create([Int32]);

  Types.unify(ListA, ListInt32);
  t.equal('List<Int32>', '' + ListA);

  t.end();
});

test('Function, add function call', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Add = scope.createFunctionType([Int32, Int32], Int32);
  const arg1 = Int32;
  const arg2 = Types.createVariable('a');
  const result = Types.createVariable('b');
  Types.unifyCall(Add, [arg1, arg2], result);

  t.equal(result.actual, Int32);
  t.equal(arg2.actual, Int32);

  t.end();
});

test('Function, wrong argument type', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');
  const Add = scope.createFunctionType([Int32, Int32], Int32);
  const result = Types.createVariable('b');

  t.throws(() =>
    Types.unifyCall(Add, [Int32, Float64], result));
  t.end();
});

test('Function, unknown type', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');
  const Add = Types.createVariable('add');
  const arg1 = Int32;
  const arg2 = Float64;
  const result = Types.createVariable();
  Types.unifyCall(Add, [arg1, arg2], result);

  t.equal('(Int32, Float64) -> \'0', '' + Add);
  t.end();
});

test('Nested call of unknown function', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');

  const T = Types.createVariable('T');
  const Id = seal(scope.createFunctionType([T], T));

  const Add = Types.createVariable('add');

  const Double = scope.createFunctionType([Int32], Int32);

  // - We know nothing about `add`.
  // - We know that id is ('a) -> 'a
  // - We know that double takes an Int32 and returns an Int32
  //
  // Example:
  //
  // ```
  // double(id(add(10, 15)))
  // ```
  //
  // We should be able to infer that add: (Int32, Int32) -> Int32

  const addResult = Types.createVariable();
  Types.unifyCall(Add, [Int32, Int32], addResult);

  const idResult = Types.createVariable();
  Types.unifyCall(Id, [addResult], idResult);

  const doubleResult = Types.createVariable();
  Types.unifyCall(Double, [idResult], doubleResult);

  t.equal('(Int32, Int32) -> Int32', '' + Add);

  t.end();
});

test('Function, two calls of identity', t => {
  const scope = Types.createScope();
  const a = Types.createVariable('a');
  const Id = seal(scope.createFunctionType([a], a));

  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');

  const intResult = Types.createVariable();
  Types.unifyCall(Id, [Int32], intResult);

  const floatResult = Types.createVariable();
  Types.unifyCall(Id, [Float64], floatResult);

  t.equal(intResult.actual, Int32);
  t.equal(floatResult.actual, Float64);

  t.end();
});

test('Overloading', t => {
  const scope = Types.createScope();

  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');
  const Str = scope.registerTerminal('String');

  t.test('add', t => {
    // 1. Add for ints and floats
    //    add(x: Int32, y: Int32): Int32
    //    add(x: Float32, y: Float32): Float32
    const addi = seal(scope.createFunctionType([Int32, Int32], Int32));
    const addf = seal(scope.createFunctionType([Float64, Float64], Float64));

    const add = scope.createUnion([addi, addf]);

    t.throws(() =>
      Types.unifyCall(add,
        [Types.createVariable(), Types.createVariable()],
        Types.createVariable()));

    const intResult = Types.createVariable();
    Types.unifyCall(add, [Types.createVariable(), Int32], intResult);
    t.equal(intResult.actual, Int32);

    const floatResult = Types.createVariable();
    Types.unifyCall(add, [Float64, Float64], floatResult);
    t.equal(floatResult.actual, Float64);

    t.end();
  });

  t.test('length', t => {
    // 2. Length for Arrays and Lists and generic
    //    template<T> length(c: T): Int32
    //    template<U> length(c: Array<T>): Int32
    //    template<U> length(c: List<T>): Int32
    const Arr = scope.registerTemplate('Array', ['T']);
    const List = scope.registerTemplate('List', ['T']);
    const lenGeneric = seal(scope.createFunctionType(
      [Types.createVariable()], Str));
    const lenArr = seal(scope.createFunctionType(
      [Arr.create([Types.createVariable()])], Int32));
    const lenList = seal(scope.createFunctionType(
      [List.create([Types.createVariable()])], Float64));

    const len = scope.createUnion([lenGeneric, lenArr, lenList]);

    // It uses the best fit (~least generic)
    const arrResult = Types.createVariable();
    Types.unifyCall(len, [Arr.create([Int32])], arrResult);
    t.equal(arrResult.actual, Int32);

    const strResult = Types.createVariable();
    Types.unifyCall(len, [Str], strResult);
    t.equal(strResult.actual, Str);

    t.end();
  });

  t.end();
});

test('Generic generics', { skip: true }, t => {
  /*
   * template<Wrap, T, U>
   * map(f: (T) => U, wrapped: Wrap<T>) {
   *   // Implementation unknown
   * }
   *
   * template<Wrap>
   * doubleIfPositive(wrapped: Wrap<Int32>) {
   *   return map(wrapped, x => {
   *     return x > 0 ? x * 2 : x;
   *   });
   * }
   */
  // const scope = Types.createScope();
  // const a = Types.createVariable('Wrap');
});

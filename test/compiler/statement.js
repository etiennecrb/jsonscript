const test = require('tape');

const { compile } = require('../../dist/jsonmacro.compiler');
const { TYPE_VAR, TYPE_FUNC, TYPE_PROP, TYPE_CALL } = require('../utils');

test('Empty strings parsing', t => {
    t.deepEqual(compile(''), [], 'it should return an empty array if parsing the empty string');
    t.deepEqual(compile('  \n \r'), [], 'it should return an empty array if parsing a string with only whitespaces');
    t.end();
});

test('Variable assignment', t => {
    t.deepEqual(
        compile('myVar = 2'),
        [{'=': [{'var': ['myVar']}, 2]}],
        'it should parse variable assignment as a statement'
    );
    t.deepEqual(
        compile(`
            myVar1 = 1
            myVar2 = 2
        `),
        [{'=': [{[TYPE_VAR]: ['myVar1']}, 1]}, {'=': [{[TYPE_VAR]: ['myVar2']}, 2]}],
        'it should parse multiple variable assignments as multiple statements'
    );
    t.end();
});

test('Function call parsing', t => {
    t.deepEqual(
        compile('myFunc(myVar, "test")'),
        [{ [TYPE_FUNC]: ['myFunc', [{[TYPE_VAR]: ['myVar']}, 'test']] }],
        'it should parse function call as a statement'
    );
    t.deepEqual(
        compile(`
            myFunc(myVar, "test")
            doNothing()
        `),
        [
            { [TYPE_FUNC]: ['myFunc', [{[TYPE_VAR]: ['myVar']}, 'test']] },
            { [TYPE_FUNC]: ['doNothing', []]}
        ],
        'it should parse multiple function calls as multiple statements'
    );
    t.end();
});


test('If then else parsing', t => {
    t.deepEqual(
        compile(`
            if 1 != 0 then
                doNothing()
            end
        `),
        [{'if': [{'!=': [1, 0]}, [{[TYPE_FUNC]: ['doNothing', []]}], []]}],
        'it should parse simple if then statement'
    );

    t.deepEqual(
        compile(`
            if 1 != 0 then doNothing() end
        `),
        [{'if': [{'!=': [1, 0]}, [{[TYPE_FUNC]: ['doNothing', []]}], []]}],
        'it should allow if then statement without indentation'
    );

    t.throws(
        () => compile(`
            if 1 != 0 then
                doNothing()
        `),
        undefined,
        'it should not allow if then statement without end keyword'
    );

    t.throws(
        () => compile(`
            if 1 != 0
                doNothing()
            end
        `),
        undefined,
        'it should not allow if then statement without then keyword'
    );

    t.deepEqual(
        compile(`
            if 1 != 0 then
                doNothing()
            else
                doSomething()
            end
        `),
        [{'if': [{'!=': [1, 0]}, [{[TYPE_FUNC]: ['doNothing', []]}], [{[TYPE_FUNC]: ['doSomething', []]}]]}],
        'it should parse simple if then else statement'
    );

    t.throws(
        () => compile(`
            if 1 != 0 then
                doNothing()
            else
                doSomething()
        `),
        undefined,
        'it should not allow if then else statement without end keyword'
    );

    t.deepEqual(
        compile(`
            if 1 != 0 then
                doNothing()
            else if 2 > 0 then
                doSomething()
            end
        `),
        [{'if': [
            {'!=': [1, 0]},
            [
                {[TYPE_FUNC]: ['doNothing', []]},
            ],
            [{'if': [
                {'>': [2, 0]},
                [{[TYPE_FUNC]: ['doSomething', []]}],
                []
            ]}]
        ]}],
        'it should parse if then else if statement'
    );

    t.throws(
        () => compile(`
            if 1 != 0 then
                doNothing()
            else if 2 > 0 then
                doSomething()
        `),
        undefined,
        'it should not allow if then else if statement without end keyword'
    );

    t.deepEqual(
        compile(`
            if 1 != 0 then
                doNothing()
            else if 2 > 0 then
                doSomething()
            else
                doSomethingElse()
            end
        `),
        [{'if': [
            {'!=': [1, 0]},
            [
                {[TYPE_FUNC]: ['doNothing', []]},
            ],
            [{'if': [
                {'>': [2, 0]},
                [{[TYPE_FUNC]: ['doSomething', []]}],
                [{[TYPE_FUNC]: ['doSomethingElse', []]}]
            ]}]
        ]}],
        'it should parse if then else if else statement'
    );
    t.throws(
        () => compile(`
            if 1 != 0 then
                doNothing()
            else if 2 > 0 then
                doSomething()
            else
                doSomethingElse()
        `),
        undefined,
        'it should not allow if then else if else statement without end keyword'
    );

    t.deepEqual(
        compile(`
            if 1 != 0 then
                if 2 != 1 then
                    if 3 != 2 then
                        doNothing()
                    end
                end
            end
        `),
        [{'if':[{'!=': [1, 0]}, [
            {'if': [{'!=': [2, 1]}, [
                {'if': [{'!=': [3, 2]}, [
                    {[TYPE_FUNC]: ['doNothing', []]}
                ],
                    []
                ]}
            ],
                []
            ]}
        ],
            []
        ]}],
        'it should parse nested if then statements'
    );
    t.end();
});

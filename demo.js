document.addEventListener('DOMContentLoaded', () => {
    CodeMirror.defineSimpleMode('jsonmacro', {
        // The start state contains the rules that are intially used
        start: [
            {regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: "string"},
            {regex: /(?:end|if|then|else|and|or|not|is|in|for each|while|do)\b/, token: "keyword"},
            {regex: /true|false|none/, token: "atom"},
            {regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i, token: "number"},
            {regex: /\/\/.*/, token: "comment"},
            {regex: /[-+\/*=<>]+/, token: "operator"},
            // indent and dedent properties guide autoindentation
            {regex: /then|else|do|\[|\(/, indent: true},
            {regex: /end|]|\)/, dedent: true},
            {regex: /[a-z$][\w$]*/, token: "variable"}
        ],
        meta: {
            dontIndentStates: [],
            lineComment: "//"
        }
    });

    const parser = PEG.buildParser(getGrammar());

    const editor = CodeMirror(document.getElementById('editor'), {
        value: '',
        mode: 'jsonmacro',
    });

    const output = CodeMirror(document.getElementById('output'), {
        value: '',
        readOnly: true,
        mode: 'application/json'
    });

    const console = CodeMirror(document.getElementById('console'), {
        value: '',
        readOnly: true
    });

    editor.on('changes', () => {
        render(parser, editor.getValue(), output, console);
    });
});

function render(parser, value, output, console) {
    let result = null;

    try {
        result = parser.parse(value);
    } catch (e) {
        console.setValue(e.toString());
    }

    if (result) {
        const formattedResult = JSON.stringify(result)
            .replace(/:/g, ': ')
            .replace(/,/g, ',\n')
            .replace(/\[/g, '[\n')
            .replace(/]/g, '\n]')
            .replace(/\[\n\n]/g, '[]');
        output.setValue(formattedResult);
        for (let i = 0; i < output.lineCount(); i++) {
            output.indentLine(i, 'smart');
        }

        console.setValue('OK');
    }
}

function getGrammar() {
    return `
    {
  function buildExpression(left, right) {
    if (right === null) {
      return left;
    } else {
      return right.reduce(function (result, el) {
        return {[el[1]]: [result, el[3]]};
      }, left);
    }
  }
}

Start
  = __ statements:Statements? __ {
    return statements !== null ? statements : [];
  }

Statements
  = head:Statement tail:(__ Statement)* {
    return [head].concat(tail.map(function (el) { return el[1]; }));
  }

Statement
  = VariableDeclaration
  / FunctionCall
  / IfThenElse

VariableDeclaration
  = variable:Identifier __ '=' !'=' __ assignment:Expression {
    return {'=': [variable, assignment]};
  }

FunctionCall
  = Method
  / property:Identifier '(' __ argumentList: Arguments __ ')' {
    return {'func': [property['var'][0], argumentList]};
  }

IfThenElse
  = 'if' __ predicate:Expression __ 'then' __
    thenStatements:Statements __
    elseStatements:(
      'else' __ elseIfStatements:IfThenElse { return [elseIfStatements]; }
      / 'else' __ elseStatements:Statements __ 'end' __ { return elseStatements; }
      / 'end' __ { return null; }
    ) {
    return {'if': [predicate, thenStatements, elseStatements || []]};
  }

Expression
  = Or

Or
  = left:And right:( __ 'or' __ And)* {
      return buildExpression(left, right);
  }

And
  = left:Equality right:( __ 'and' __ Equality)* {
      return buildExpression(left, right);
  }

Equality
  = left:Relation right:(__ ('==' / '!=') __ Relation)* {
      return buildExpression(left, right);
    }

Relation
  = left:Sum right:(__ ('<=' / '>=' / '<' / '>') __ Sum)* {
      return buildExpression(left, right);
    }

Sum
  = left:Product right:( __ ('+' / '-') __ Product)* {
      return buildExpression(left, right);
  }

Product
  = left:Term right:( __ ('*' / '/') __ Term)* {
      return buildExpression(left, right);
  }

Term
  = SignedNumber
  / FunctionCall
  / Prop
  / Identifier
  / Array
  / String
  / '(' __ exp:Expression __ ')' {
    return exp;
  }

SignedNumber
  = [+-]? Number { return parseFloat(text()); }

Number "number"
  = [0-9] "." [0-9]* {
      return parseFloat(text());
    }
  / "." [0-9]+ {
      return parseFloat(text());
    }
  / [0-9]+ {
      return parseFloat(text());
    }

Prop
  = head:Identifier
    tail:('.'
      (property:Identifier '(' __ argumentList: Arguments __ ')' {
         return {property: property['var'][0], call: true, argumentList: argumentList};
      }
      / property:Identifier {
        return {property: property['var'][0], call: false};
      })
    )+ {
      return tail.reduce(function(acc, element) {
        var operator = element[1].call ? 'method' : 'property';
        var result = {};
        result[operator] = [acc, element[1].property];
        if (element[1].call) {
          result[operator].push(element[1].argumentList);
        }
        return result;
      }, head);
    }

Method
  = left:Identifier
    middle:('.'
      (property:Identifier '(' __ argumentList: Arguments __ ')' {
         return {property: property['var'][0], call: true, argumentList: argumentList};
      }
      / property:Identifier {
        return {property: property['var'][0], call: false};
      })
    )*
    right:('.'
      property:Identifier '(' __ argumentList: Arguments __ ')' {
         return {property: property['var'][0], call: true, argumentList: argumentList};
      }
    ) {
      return (middle || []).concat(right).reduce(function(acc, element) {
        var operator = element[1].call ? 'method' : 'property';
        var result = {};
        result[operator] = [acc, element[1].property];
        if (element[1].call) {
          result[operator].push(element[1].argumentList);
        }
        return result;
      }, head);
    }

Arguments
  = left:Expression right:(__ "," __ Expression)* {
      if (right === null) {
        return [left];
      } else {
        return [left].concat(right.map(function (el) { return el[3]; }));
      }
    }
  / __ {
    return [];
  }

Identifier
  = !ReservedWord name:IdentifierName { return name; }

IdentifierName "identifier"
  = head:IdentifierPart tail:IdentifierPart* {
      return {'var': [head + tail.join('')]};
    }

IdentifierPart
  = [a-zA-Z]
  / '_'
  / '$'

Array "array"
  = "[" __ elements:ElementList __ "]" {
      return elements;
    }

ElementList
  = head:(element:Expression) tail:(__ "," __ element:Expression { return element; })* {
    return Array.prototype.concat.apply([head], tail);
  }

String "string"
  = '"' chars:StringCharacter* '"' {
      return chars.join('');
    }

StringCharacter
  = !('"') . { return text(); }

ReservedWord
  = 'if'
  / 'then'
  / 'else'
  / 'for each'
  / 'end'
  / 'while'
  / 'in'
  / 'and'
  / 'or'

__
  = WhiteSpace*

WhiteSpace "whitespace"
  = "\\n"
  / "\\r"
  / "\\t"
  / " "

    `
}

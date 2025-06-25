import { derivative } from "mathjs";

const operators = {
  "+": ["add", 2, 0],
  "-": ["minus", 2, 0],
  "*": ["multiply", 2, 1],
  "/": ["divide", 2, 1],
  "%": ["mod", 2, 1],
  "!": ["factorial", 1, 2],
  "^": ["pow", 2, 3]
}
const functions = {
  abs: 1,
  pow: 2, sqrt: 1,
  exp: 1, log: 1,
  sin: 1, cos: 1, tan: 1,
  asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1,
  asinh: 1, acosh: 1, atanh: 1,
  ceil: 1, floor: 1, round: 1,
  mod: 1,
  factorial: 1, gamma: 1,
  derivative: 2, integral: 2,
  bounded_integral: 4
}
const braces = {")": "(", "]": "[", "}": "{"}
const open_braces = ["(", "[", "{"]


function tokenise(eq) {
  const variable = String.raw`[a-zA-Z](_[a-zA-Z0-9]|_{[a-zA-Z]*[0-9]*\.?[0-9]*})?`;
  const tokens = eq.match(new RegExp(String.raw`\\frac{(d|\\partial)((\^[0-9]|\^{[0-9]+})?)( ?${variable}|\\[a-z]+)?}{\1( ?${variable}|\\[a-z]+)\2}|(?<=\\)[a-z]+|[=+*^\-\/[\]{}(),]|[0-9]+(\.[0-9]+)?|${variable}`, "g"));
  const var_match = new RegExp(variable, "g");
  let brace_match;
  let brace_layer = 0;
  let token;
  for (let i = 0; i < tokens.length(); i++) {
    token = tokens[i];
    switch (token) {
      case "left":
      case "right":
      case "text":
        tokens.splice(i, 1);
        break;

      case "-":
        if (i == 0 || open_braces.includes(tokens[i-1]) || tokens[i-1] in operators) {
          tokens.splice(i, 1, "-1", "*");
        }
        break;

      case "+":
        tokens.splice(i, 1);
        break;
      
      case "cdot":
        tokens.splice(i, 1, "*");
      
      case "frac":
      case "div":
        tokens.splice(i, 1, "/");

      case "[":
        if (tokens[i-1] == "sqrt") {
          brace_match = brace_layer;
        } else {
          tokens.splice(i, 1, "(");
        }
        brace_layer++;
        break;

      case "]":
        if (--brace_layer != brace_match) {
          tokens.splice(i, 1, ")");
        }
        break;
      
      default:
        if (token.startsWith("\\")) {
          const start = token[7] == "d" ? 1 : 8;
          const end = token.indexOf("}");
          let exp = 1;
          let arg1 = "";
          let arg2;
          if (token[7 + start] == "^") {
            if (token[8 + start] == "{") {
              exp = Number(token.slice(9 + start, end));
              if (token[end + 1] == "}") {
                arg2 = token.slice(end + 3 + start, 9 + start - end).trimStart();
              } else {
                arg1 = token.slice(end + 1, token.indexOf("}", end + 1));
                arg2 = token.slice(token.indexOf("{", end + 1) + 1 + start, 9 + start - end).trimStart();
              }
            } else {
              exp = Number(token[8 + start]);
              if (9 + start == end) {
                arg1 = token.slice(9 + start, end);
              }
              arg2 = token.slice(end + 2 + start, -3).trimStart();
            }
          } else if (7 + start != end) {
            arg1 = token.slice(7 + start, end);
          }
          arg2 = token.slice(end + 2 + start, -1).trimStart();
          if (arg1 == "") {
            tokens.splice(i, 1, ...new Array(exp).fill("derivative"), ...new Array(exp).fill(arg2));
          } 
          else if (arg1 in udf && ((start == 8 && udf[arg1].includes(arg2)) || (start == 1 && udf[arg1] == [arg2]))) {
            tokens.splice(i, 1, ...new Array(exp).fill("derivative"), ...new Array(exp).fill(arg2), arg1);
          }
          else {
            tokens.splice(i, 1, );
          }
        }
    }
  }
  return tokens;
}

function shuntingYard(expr_queue) {
  const output_stack = [];
  const operator_stack = [];
  let current;
  let operator;
  let isfunc;
  let isoperator;
  let precedence;

  function popn(n) {
    return output_stack.splice(-n, n);
  }

  function createNode(operator, isoperator, isfunc) {
    if (typeof isfunc === "undefined") {
      isfunc = operator in functions;
    }
    if (typeof isoperator === "undefined") {
      isoperator = operator in functions;
    }
    if (isfunc) {
      if (operator == "sqrt" && output_stack.at(-2) == "]") {
        output_stack.push(new math.OperatorNode("^", "pow", [output_stack.pop(), new math.OperatorNode("/", "divide", [1, output_stack.at(-2)])]));
        output_stack.pop();
      }
      else if (operator == "derivative") {
        math.derivative(arg)
      }
      else {
        output_stack.push(new math.FunctionNode(operator, popn(functions[operator])));
      }
    }
    else if (isoperator) {
      output_stack.push(new math.OperatorNode(operator, operators[operator][0], popn(operators[operator][1])));
    }
  }

  while (expr_queue) {
    current = expr_queue.shift();

    if (current in operators) {
      precedence = operators[current][2];
      operator = operator_stack.at(-1);
      isoperator = operator in operators;
      isfunc = operator in functions;
      while ((isoperator && operators[operator][2] >= precedence) || (isfunc && precedence == 0)) {
        createNode(operator, isfunc);
        operator_stack.pop();
        operator = operator_stack.at(-1);
        isoperator = operator in operators;
        isfunc = operator in functions;
      }
      operator_stack.push(current);
    }

    else if (current in functions) {
      operator_stack.push(current);
    }

    else if (open_braces.includes(current)) {
      operator_stack.push(current);
    }

    else if (current in braces) {
      while (operator_stack.at(-1) != braces[current]) {
        operator = operator_stack.pop();
        createNode(operator);
      }
      operator_stack.pop();
      if (current == "]") {
        output_stack.push(current);
      }
    }

    else if (current == ",") {
      while (operator_stack.at(-1) != "(") {
        operator = operator_stack.pop();
        createNode(operator);
      }
    }

    else {
        if (!isNaN(current) || current == "pi" || current == "e" || current == "i") {
            output_stack.push(new math.ConstantNode(current))
        } else {
            output_stack.push(new math.SymbolNode(current))
        }
        if (!(expr_queue[0] in operators)) {
            expr_queue.unshift("*");
        }
    }
  }

  while (operator_stack.length > 0) {
    operator = operator_stack.pop();
    createNode(operator);
  }

  return output_stack[0];
}

import { MikaCliError } from "../../errors.js";

export type FilterOperator = ">" | "<" | ">=" | "<=" | "=" | "!=" | "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "IN" | "BETWEEN";
export type LogicalOperator = "AND" | "OR";

interface FilterToken {
  type: "field" | "operator" | "value" | "logical" | "paren";
  value: string;
}

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
  originalValue: string;
}

interface FilterExpression {
  type: "condition" | "group";
  operator?: LogicalOperator;
  condition?: FilterCondition;
  children?: FilterExpression[];
}

/**
 * Parse and evaluate filter expressions like:
 * "stargazers_count > 100 AND language = 'TypeScript'"
 * "created_at > 'now-7d' OR rating >= 4.0"
 */
export class FilterExpressionParser {
  private expression: string;
  private tokens: FilterToken[] = [];
  private position = 0;

  constructor(expression: string) {
    this.expression = expression.trim();
  }

  parse(): FilterExpression {
    this.tokenize();
    return this.parseLogicalExpression();
  }

  evaluate(obj: Record<string, unknown>): boolean {
    const ast = this.parse();
    return this.evaluateExpression(ast, obj);
  }

  private tokenize(): void {
    const chars = this.expression.split("");
    let current = "";
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i] || "";

      if (inString) {
        if (char === stringChar && (chars[i - 1] || "") !== "\\") {
          inString = false;
          current += char;
        } else {
          current += char;
        }
        continue;
      }

      if ((char === '"' || char === "'") && (chars[i - 1] || "") !== "\\") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (/\s/.test(char)) {
        if (current) {
          this.addToken(current);
          current = "";
        }
        continue;
      }

      if ("()".includes(char)) {
        if (current) {
          this.addToken(current);
          current = "";
        }
        this.addToken(char);
        continue;
      }

      current += char;
    }

    if (current) {
      this.addToken(current);
    }
  }

  private addToken(value: string): void {
    const upper = value.toUpperCase();

    if (value === "(" || value === ")") {
      this.tokens.push({ type: "paren", value });
    } else if (upper === "AND" || upper === "OR") {
      this.tokens.push({ type: "logical", value: upper });
    } else if (this.isOperator(value)) {
      this.tokens.push({ type: "operator", value });
    } else if (this.isValue(value)) {
      this.tokens.push({ type: "value", value });
    } else {
      this.tokens.push({ type: "field", value });
    }
  }

  private isOperator(value: string): boolean {
    const operators = [">", "<", ">=", "<=", "=", "!=", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "BETWEEN"];
    return operators.includes(value.toUpperCase());
  }

  private isValue(value: string): boolean {
    return (
      /^'.*'$/.test(value) ||
      /^".*"$/.test(value) ||
      /^\d+(\.\d+)?$/.test(value) ||
      /^(true|false|null)$/i.test(value) ||
      /^now(-\d+[dhm])?$/i.test(value) ||
      /^\d{4}-\d{2}-\d{2}$/i.test(value) ||
      /^(today|yesterday)$/i.test(value)
    );
  }

  private parseLogicalExpression(): FilterExpression {
    return this.parseOr();
  }

  private parseOr(): FilterExpression {
    let left = this.parseAnd();

    while (this.peek() && this.peek()!.value.toUpperCase() === "OR") {
      this.consume();
      const right = this.parseAnd();

      left = {
        type: "group",
        operator: "OR",
        children: [left, right],
      };
    }

    return left;
  }

  private parseAnd(): FilterExpression {
    let left = this.parsePrimary();

    while (this.peek() && this.peek()!.value.toUpperCase() === "AND") {
      this.consume();
      const right = this.parsePrimary();

      left = {
        type: "group",
        operator: "AND",
        children: [left, right],
      };
    }

    return left;
  }

  private parsePrimary(): FilterExpression {
    const token = this.peek();

    if (!token) {
      throw new MikaCliError("FILTER_PARSE_ERROR", "Unexpected end of filter expression");
    }

    if (token.value === "(") {
      this.consume();
      const expr = this.parseLogicalExpression();
      const next = this.consume();
      if (next?.value !== ")") {
        throw new MikaCliError("FILTER_PARSE_ERROR", "Expected closing parenthesis");
      }
      return expr;
    }

    const condition = this.parseCondition();
    return {
      type: "condition",
      condition,
    };
  }

  private parseCondition(): FilterCondition {
    const fieldToken = this.consume();
    if (!fieldToken || fieldToken.type !== "field") {
      throw new MikaCliError("FILTER_PARSE_ERROR", "Expected field name");
    }

    const operatorToken = this.consume();
    if (!operatorToken || !this.isOperator(operatorToken.value)) {
      const op = operatorToken?.value || "(none)";
      throw new MikaCliError("FILTER_PARSE_ERROR", `Expected operator after field "${fieldToken.value}", got "${op}"`);
    }

    const valueToken = this.consume();
    if (!valueToken || valueToken.type !== "value") {
      throw new MikaCliError("FILTER_PARSE_ERROR", `Expected value after operator "${operatorToken.value}"`);
    }

    return {
      field: fieldToken.value,
      operator: operatorToken.value.toUpperCase() as FilterOperator,
      value: this.parseValue(valueToken.value),
      originalValue: valueToken.value,
    };
  }

  private parseValue(valueStr: string): unknown {
    if (/^'.*'$/.test(valueStr) || /^".*"$/.test(valueStr)) {
      return valueStr.slice(1, -1);
    }

    if (/^\d+$/.test(valueStr)) {
      return Number.parseInt(valueStr, 10);
    }

    if (/^\d+\.\d+$/.test(valueStr)) {
      return Number.parseFloat(valueStr);
    }

    if (/^true$/i.test(valueStr)) {
      return true;
    }

    if (/^false$/i.test(valueStr)) {
      return false;
    }

    if (/^null$/i.test(valueStr)) {
      return null;
    }

    if (/^now(-\d+[dhm])?$/i.test(valueStr) || /^(today|yesterday)$/i.test(valueStr)) {
      return this.parseTemporalValue(valueStr);
    }

    return valueStr;
  }

  private parseTemporalValue(value: string): Date {
    const upper = value.toUpperCase();
    const now = new Date();

    if (upper === "NOW" || upper === "TODAY") {
      return now;
    }

    if (upper === "YESTERDAY") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    const match = /^NOW(-(\d+)([DHM]))$/i.exec(upper);
    if (match) {
      const offset = new Date(now);
      const amount = Number.parseInt(match[2] ?? "0", 10);
      const unit = (match[3] ?? "M").toUpperCase();

      switch (unit) {
        case "D":
          offset.setDate(offset.getDate() - amount);
          break;
        case "H":
          offset.setHours(offset.getHours() - amount);
          break;
        case "M":
          offset.setMonth(offset.getMonth() - amount);
          break;
      }

      return offset;
    }

    return now;
  }

  private evaluateExpression(expr: FilterExpression, obj: Record<string, unknown>): boolean {
    if (expr.type === "condition" && expr.condition) {
      return this.evaluateCondition(expr.condition, obj);
    }

    if (expr.type === "group") {
      const children = expr.children || [];
      const operator = expr.operator;

      if (operator === "AND") {
        return children.every((child) => this.evaluateExpression(child, obj));
      }

      if (operator === "OR") {
        return children.some((child) => this.evaluateExpression(child, obj));
      }
    }

    return true;
  }

  private evaluateCondition(condition: FilterCondition, obj: Record<string, unknown>): boolean {
    const fieldValue = this.getNestedValue(obj, condition.field);
    const compareValue = condition.value;

    switch (condition.operator) {
      case ">":
        return (fieldValue as number) > (compareValue as number);
      case "<":
        return (fieldValue as number) < (compareValue as number);
      case ">=":
        return (fieldValue as number) >= (compareValue as number);
      case "<=":
        return (fieldValue as number) <= (compareValue as number);
      case "=":
        return fieldValue === compareValue;
      case "!=":
        return fieldValue !== compareValue;
      case "CONTAINS":
        return String(fieldValue).includes(String(compareValue));
      case "STARTS_WITH":
        return String(fieldValue).startsWith(String(compareValue));
      case "ENDS_WITH":
        return String(fieldValue).endsWith(String(compareValue));
      case "IN":
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case "BETWEEN":
        // Simplified: expects [min, max]
        if (Array.isArray(compareValue) && compareValue.length === 2) {
          return (fieldValue as number) >= (compareValue[0] as number) && (fieldValue as number) <= (compareValue[1] as number);
        }
        return false;
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private peek(): FilterToken | undefined {
    return this.tokens[this.position];
  }

  private consume(): FilterToken | undefined {
    return this.tokens[this.position++];
  }
}

export function parseFilterExpression(expression: string): FilterExpression {
  return new FilterExpressionParser(expression).parse();
}

export function evaluateFilter(expression: string, obj: Record<string, unknown>): boolean {
  return new FilterExpressionParser(expression).evaluate(obj);
}

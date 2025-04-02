import * as Assembly from "./Assembly.ts";
import { Symbol } from "./Symbols.ts";

export class ReplacePseudoes {
    private offsetMap: Map<string, number> = new Map();
    private currentOffset = 0;

    replacePseudoes(program: Assembly.Program, symbolTable: Map<string, Symbol>): Assembly.Program {
        return {
            topLevelConstructs: program.topLevelConstructs.map(
                c => this.replacePseudosinTopLevelConstruct(c, symbolTable)
            )
        };
    }

    private replacePseudosinTopLevelConstruct(construct: Assembly.TopLevelConstruct, symbolTable: Map<string, Symbol>): Assembly.TopLevelConstruct {
        switch (construct.tag) {
            case "function":
                return this.replacePseudosInFunction(construct, symbolTable);
            case "staticvariable":
                return construct;
        }
    }

    private replacePseudosInFunction(fn: Assembly.Function, symbolTable: Map<string, Symbol>): Assembly.Function {
        this.currentOffset = 0;
        return {
            tag: "function",
            name: fn.name,
            global: fn.global,
            instructions: fn.instructions.map(i => this.replacePseudosInInstruction(i, symbolTable)),
            stackOffset: Math.abs(this.currentOffset)
        };
    }

    private replacePseudosInInstruction(instruction: Assembly.Instruction, symbolTable: Map<string, Symbol>): Assembly.Instruction {
        switch (instruction.tag) {
            case "mov":
                return {
                    tag: "mov",
                    src: this.replaceOperand(instruction.src, symbolTable),
                    dst: this.replaceOperand(instruction.dst, symbolTable)
                };
            case "unary":
                return {
                    tag: "unary",
                    operator: instruction.operator,
                    operand: this.replaceOperand(instruction.operand, symbolTable)
                };
            case "binary":
                return {
                    tag: "binary",
                    operator: instruction.operator,
                    src: this.replaceOperand(instruction.src, symbolTable),
                    dst: this.replaceOperand(instruction.dst, symbolTable)
                };
            case "cmp":
                return {
                    tag: "cmp",
                    operand1: this.replaceOperand(instruction.operand1, symbolTable),
                    operand2: this.replaceOperand(instruction.operand2, symbolTable)
                };
            case "idiv":
                return {
                    tag: "idiv",
                    operand: this.replaceOperand(instruction.operand, symbolTable)
                };
            case "setcc":
                return {
                    tag: "setcc",
                    conditionCode: instruction.conditionCode,
                    operand: this.replaceOperand(instruction.operand, symbolTable)
                };
            case "push":
                return {
                    tag: "push",
                    operand: this.replaceOperand(instruction.operand, symbolTable)
                };
            default: return instruction;
        };
    }

    private replaceOperand(op: Assembly.Operand, symbolTable: Map<string, Symbol>): Assembly.Operand {
        switch (op.tag) {
            case "pseudo": {
                if (this.offsetMap.has(op.value) === false) {
                    if (symbolTable.has(op.value)) {
                        const symbol = symbolTable.get(op.value)!;
                        if (symbol.attrs && symbol.attrs.tag === "staticattr") {
                            return { tag: "data", identifier: op.value };
                        }
                    }
                    this.currentOffset -= 4;
                    this.offsetMap.set(op.value, this.currentOffset);
                }
                return { tag: "stack", value: this.offsetMap.get(op.value)! };
            }
            default: return op;
        }
    }
};

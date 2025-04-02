import * as Assembly from "./Assembly.ts";
import * as Tacky from "./Tacky.ts";

export class CodeGen {
    argRegisters: Assembly.Register[] = ["DI", "SI", "DX", "CX", "R8", "R9"];

    generate(program: Tacky.Program): Assembly.Program {
        const topLevelConstructs = program.topLevelConstructs.map(c => this.convertTopLevelConstructs(c));
        return { topLevelConstructs: topLevelConstructs };
    }

    private convertTopLevelConstructs(construct: Tacky.TopLevelConstruct): Assembly.TopLevelConstruct {
        switch (construct.tag) {
            case "function":
                return this.convertFunction(construct);
            case "staticvariable":
                return {
                    tag: "staticvariable",
                    identifier: construct.identifier,
                    global: construct.global,
                    init: construct.init
                };
        }
    }

    private convertFunction(fn: Tacky.Function): Assembly.Function {
        const instructions: Assembly.Instruction[] = [];

        // first six args are put in registers
        fn.params
            .slice(0, this.argRegisters.length)
            .forEach((param, idx) => {
                instructions.push({
                    tag: "mov",
                    src: { tag: "reg", value: this.argRegisters[idx] },
                    dst: { tag: "pseudo", value: param }
                });
            });

        // the rest go on the stack in reverse order
        fn.params
            .slice(this.argRegisters.length)
            .forEach((param, idx) => {
                instructions.push({
                    tag: "mov",
                    // args are put on the stack starting at 16 and then eight
                    // byte aligned.
                    src: { tag: "stack", value: 16 + (8 * idx) },
                    dst: { tag: "pseudo", value: param }
                });
            });

        return {
            tag: "function",
            name: fn.name,
            global: fn.global,
            instructions: instructions.concat(fn.body.flatMap(x => this.convertInstruction(x))),
            stackOffset: 0
        };
    }

    private convertInstruction(instruction: Tacky.Instruction): Assembly.Instruction[] {
        switch (instruction.tag) {
            case "return": return this.convertReturnInstruction(instruction);
            case "unary": {
                switch (instruction.op) {
                    case "Not": {
                        return [
                            { tag: "cmp", operand1: { tag: "imm", value: 0 }, operand2: this.convertVal(instruction.src) },
                            { tag: "mov", src: { tag: "imm", value: 0 }, dst: this.convertVal(instruction.dst) },
                            { tag: "setcc", conditionCode: "E", operand: this.convertVal(instruction.dst) }
                        ];
                    }
                    default: return [
                        { tag: "mov", src: this.convertVal(instruction.src), dst: this.convertVal(instruction.dst) },
                        { tag: "unary", operator: this.convertUnaryOp(instruction.op), operand: this.convertVal(instruction.dst) }
                    ];
                }
            }
            case "binary": {
                const src1 = this.convertVal(instruction.src1);
                const src2 = this.convertVal(instruction.src2);
                const dst = this.convertVal(instruction.dst);
                switch (instruction.op) {
                    case "Equal":
                    case "NotEqual":
                    case "LessThan":
                    case "LessOrEqual":
                    case "GreaterThan":
                    case "GreaterOrEqual": {
                        const code = this.convertConditionCode(instruction.op);
                        return [
                            { tag: "cmp", operand1: src2, operand2: src1 },
                            { tag: "mov", src: { tag: "imm", value: 0 }, dst },
                            { tag: "setcc", conditionCode: code, operand: dst }
                        ];
                    }
                    case "Divide":
                    case "Remainder": {
                        const resultReg: Assembly.Reg = instruction.op === "Divide"
                            ? { tag: "reg", value: "AX" }
                            : { tag: "reg", value: "DX" };
                        return [
                            { tag: "mov", src: src1, dst: { tag: "reg", value: "AX" } },
                            { tag: "cdq" },
                            { tag: "idiv", operand: src2 },
                            { tag: "mov", src: resultReg, dst: dst }
                        ];
                    }
                    default: {
                        const op = this.convertBinaryOp(instruction.op);
                        return [
                            { tag: "mov", src: src1, dst },
                            { tag: "binary", operator: op, src: src2, dst }
                        ];
                    }
                }
                throw new Error("Unreachable code.");
            }
            case "copy":
                return [
                    { tag: "mov", src: this.convertVal(instruction.src), dst: this.convertVal(instruction.dst) },
                ]
            case "jump": return [{ tag: "jmp", identifier: instruction.target }];
            case "jumpifzero":
                return [
                    { tag: "cmp", operand1: { tag: "imm", value: 0 }, operand2: this.convertVal(instruction.condition) },
                    { tag: "jmpcc", conditionCode: "E", identifier: instruction.target }
                ];
            case "jumpifnotzero":
                return [
                    { tag: "cmp", operand1: { tag: "imm", value: 0 }, operand2: this.convertVal(instruction.condition) },
                    { tag: "jmpcc", conditionCode: "NE", identifier: instruction.target }
                ];
            case "label": return [{ tag: "label", identifier: instruction.value }];
            case "fncall": return this.convertFunctionCall(instruction);
        }
    }

    private convertReturnInstruction(instruction: Tacky.Return): Assembly.Instruction[] {
        return [
            {
                tag: "mov",
                src: this.convertVal(instruction.value),
                dst: { tag: "reg", value: "AX" }
            },
            { tag: "ret" }
        ];
    }

    private convertVal(val: Tacky.Val): Assembly.Operand {
        switch (val.tag) {
            case "constant": return { tag: "imm", value: val.value };
            case "var": return { tag: "pseudo", value: val.value };
        }
    }

    private convertUnaryOp(type: Tacky.UnaryOp): Assembly.UnaryOperator {
        switch (type) {
            case "Negate": return "Neg";
            case "Complement": return "Not";
            default: throw new Error("Undefined unary operator.");
        }
    }

    private convertConditionCode(code: Tacky.BinaryOp): Assembly.ConditionCode {
        switch (code) {
            case "Equal": return "E";
            case "NotEqual": return "NE";
            case "GreaterThan": return "G";
            case "GreaterOrEqual": return "GE";
            case "LessThan": return "L";
            case "LessOrEqual": return "LE";
            default: throw new Error("Undefined condition code.");
        }
    }

    private convertBinaryOp(type: Tacky.BinaryOp): Assembly.BinaryOperator {
        switch (type) {
            case "Add": return "Add";
            case "Subtract": return "Sub";
            case "Multiply": return "Mult";
            default: throw new Error("Undefined binary operator.");
        }
    }

    private convertFunctionCall(fnCall: Tacky.FunCall): Assembly.Instruction[] {
        const instructions: Assembly.Instruction[] = [];

        const registerArgsCount = Math.min(fnCall.args.length, 6);
        const stackArgsCount = Math.max(0, fnCall.args.length - 6);

        const stackPadding = (stackArgsCount % 2 === 0) ? 0 : 8;

        if (stackPadding !== 0) {
            instructions.push({
                tag: "allocatestack",
                value: String(stackPadding)
            });
        }

        fnCall.args
            .slice(0, registerArgsCount)
            .forEach((arg, index) => {
                instructions.push({
                    tag: "mov",
                    src: this.convertVal(arg),
                    dst: { tag: "reg", value: this.argRegisters[index] }
                });
            });

        fnCall.args
            .slice(this.argRegisters.length)
            .reverse()
            .forEach((arg) => {
                const val = this.convertVal(arg);
                if (val.tag === "reg" || val.tag === "imm") {
                    instructions.push({ tag: "push", operand: val });
                } else {
                    instructions.push(
                        {
                            tag: "mov",
                            src: val,
                            dst: { tag: "reg", value: "AX" }
                        },
                        {
                            tag: "push",
                            operand: { tag: "reg", value: "AX" }
                        }
                    );
                }
            });

        instructions.push({ tag: "call", identifier: fnCall.name });

        const bytesToRemove = 8 * stackArgsCount + stackPadding;
        if (bytesToRemove !== 0) {
            instructions.push({
                tag: "deallocateStack",
                value: String(bytesToRemove)
            });
        }

        instructions.push({
            tag: "mov",
            src: { tag: "reg", value: "AX" },
            dst: this.convertVal(fnCall.dst)
        });

        return instructions;
    }
};

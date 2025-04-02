import * as Assembly from "./Assembly.ts";

export class Emit {
    emit(program: Assembly.Program): string[] {
        const instructions: string[] = [];
        program.topLevelConstructs.forEach(c => this.emitTopLevelConstruct(c, instructions));
        return instructions;
    }

    private emitTopLevelConstruct(construct: Assembly.TopLevelConstruct, instructions: string[]): void {
        switch (construct.tag) {
            case "function":
                this.emitFunction(construct, instructions);
                break;
            case "staticvariable": {
                this.emitGlobalDirective(construct.identifier, construct.global, instructions);
                if (construct.init) {
                    instructions.push(
                        "\t.data\n",
                        `\t.balign 4\n`,
                        `_${construct.identifier}:\n`,
                        `\t.long ${construct.init}\n`,
                    );
                } else {
                    instructions.push(
                        "\t.bss\n",
                        `\t.balign 4\n`,
                        `_${construct.identifier}:\n`,
                        "\t.zero 4\n",
                    );
                }
                break;
            }
        }
    }

    private emitFunction(fn: Assembly.Function, instructions: string[]): void {
        this.emitGlobalDirective(fn.name, fn.global, instructions);
        instructions.push(
            `\t.text\n`,
            `_${fn.name}:\n`,
            "\tpushq %rbp\n",
            "\tmovq %rsp, %rbp\n",
        );
        fn.instructions.forEach(
            instruction => this.emitInstruction(instruction, instructions)
        );
    }

    private emitGlobalDirective(name: string, global: boolean, instructions: string[]): void {
        if (global) {
            instructions.push(`\t.globl _${name}\n`);
        }
    }

    private emitInstruction(instruction: Assembly.Instruction, instructions: string[]): void {
        switch (instruction.tag) {
            case "mov": {
                const src = this.showOperand("Longword", instruction.src);
                const dst = this.showOperand("Longword", instruction.dst)
                instructions.push(`\tmovl ${src}, ${dst}\n`);
                break;
            }
            case "unary":
                instructions.push(`\t${this.showUnaryInstruction(instruction)} ${this.showOperand("Longword", instruction.operand)}\n`);
                break;
            case "binary":
                instructions.push(`\t${this.showBinaryInstruction(instruction)} ${this.showOperand("Longword", instruction.src)}, ${this.showOperand("Longword", instruction.dst)}\n`);
                break;
            case "idiv":
                instructions.push(`\tidivl ${this.showOperand("Longword", instruction.operand)}\n`);
                break;
            case "cmp":
                instructions.push(`\tcmpl ${this.showOperand("Longword", instruction.operand1)}, ${this.showOperand("Longword", instruction.operand2)}\n`);
                break;
            case "cdq":
                instructions.push("\tcdq\n");
                break;
            case "jmp":
                instructions.push(`\tjmp L${instruction.identifier}\n`);
                break;
            case "jmpcc":
                instructions.push(`\tj${this.showConditionCode(instruction.conditionCode)} L${instruction.identifier}\n`);
                break;
            case "setcc":
                instructions.push(`\tset${this.showConditionCode(instruction.conditionCode)} ${this.showByteOperand(instruction.operand)}\n`);
                break;
            case "label":
                instructions.push(`L${instruction.identifier}:\n`);
                break;
            case "ret":
                instructions.push(
                    "\tmovq %rbp, %rsp\n",
                    "\tpopq %rbp\n",
                    "\tret\n",
                );
                break;
            case "allocatestack":
                instructions.push(`\tsubq $${instruction.value}, %rsp\n`);
                break;
            case "deallocateStack":
                instructions.push(`\taddq $${instruction.value}, %rsp\n`);
                break;
            case "push": {
                const label = this.showOperand("Quadword", instruction.operand);
                instructions.push(`\tpushq ${label}\n`);
                break;
            }
            case "call":
                instructions.push(`\tcall _${instruction.identifier}\n`);
                break;
        }
    }

    private showUnaryInstruction(instruction: Assembly.Unary): string {
        switch (instruction.operator) {
            case "Neg": return "negl";
            case "Not": return "notl";
            case "Shr": return "shrl";
        }
    }

    private showOperand(type: Assembly.AsmType, operand: Assembly.Operand): string {
        switch (operand.tag) {
            case "reg": {
                switch (type) {
                    case "Byte":
                        return this.showByteReg(operand.value);
                    case "Longword":
                        return this.showLongReg(operand.value);
                    case "Quadword":
                        return this.showQuadwordReg(operand.value);
                }
                throw new Error("Unreachable code.");
            }
            case "imm": return `$${operand.value}`;
            case "stack": return `${operand.value}(%rbp)`;
            case "data": return `_${operand.identifier}(%rip)`;
            default: throw new Error("Unreachable code.");
        }
    }

    private showByteReg(reg: Assembly.Register): string {
        switch (reg) {
            case "AX": return "%al";
            case "CX": return "%cl";
            case "DX": return "%dl";
            case "DI": return "%dil";
            case "SI": return "%sil";
            case "R8": return "%r8b";
            case "R9": return "%r9b";
            case "R10": return "%r10b";
            case "R11": return "%r11b";
        }
    }

    private showLongReg(reg: Assembly.Register): string {
        switch (reg) {
            case "AX": return "%eax";
            case "CX": return "%ecx";
            case "DX": return "%edx";
            case "DI": return "%edi";
            case "SI": return "%esi";
            case "R8": return "%r8d";
            case "R9": return "%r9d";
            case "R10": return "%r10d";
            case "R11": return "%r11d";
        }
    }

    private showQuadwordReg(reg: Assembly.Register): string {
        switch (reg) {
            case "AX": return "%rax";
            case "CX": return "%rcx";
            case "DX": return "%rdx";
            case "DI": return "%rdi";
            case "SI": return "%rsi";
            case "R8": return "%r8";
            case "R9": return "%r9";
            case "R10": return "%r10";
            case "R11": return "%r11";
        }
    }

    private showBinaryInstruction(instruction: Assembly.Binary) {
        switch (instruction.operator) {
            case "Add": return "addl";
            case "Sub": return "subl";
            case "Mult": return "imull";
        }
    }

    private showConditionCode(code: Assembly.ConditionCode): string {
        switch (code) {
            case "E": return "e";
            case "NE": return "ne";
            case "G": return "g";
            case "GE": return "ge";
            case "L": return "l";
            case "LE": return "le";
        }
    }

    private showByteOperand(operand: Assembly.Operand): string {
        switch (operand.tag) {
            case "reg": return this.showByteReg(operand.value);
            default: return this.showOperand("Longword", operand);
        }
    }
};

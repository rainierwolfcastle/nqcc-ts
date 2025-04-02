import * as Ast from "./Ast.ts";
import { TokenType, Token } from "./Token.ts";
import { Type, Int, FunType } from "./Types.ts";

export class Parse {

    private precedence: Map<TokenType, number> = new Map([
        ["Star", 50],
        ["Slash", 50],
        ["Percent", 50],
        ["Plus", 45],
        ["Hyphen", 45],
        ["LessThan", 35],
        ["LessThanEqual", 35],
        ["MoreThan", 35],
        ["MoreThanEqual", 35],
        ["EqualEqual", 30],
        ["BangEqual", 30],
        ["AmpersandAmpersand", 10],
        ["VerticalBarVerticalBar", 5],
        ["TernaryIf", 3],
        ["Equal", 1],
    ]);

    parse(tokens: Token[]): Ast.Program {
        return this.parseProgram(tokens);
    }

    private parseProgram(tokens: Token[]): Ast.Program {
        const declarations = [];
        while (tokens.length > 0) {
            declarations.push(this.parseDeclaration(tokens));
        }
        return { funDecls: declarations };
    }

    private parseParamList(tokens: Token[]): string[] {
        const params: string[] = [];
        if (this.peek(tokens).type === "Void") {
            this.takeToken(tokens);
            return params;
        }
        while (true) {
            this.expect("Int", tokens);
            const token = this.takeToken(tokens);
            if (token.type !== "Identifier") throw new Error("Syntax Error");
            params.push(token.lexeme);
            if (this.peek(tokens).type === "Comma") {
                this.takeToken(tokens);
            } else {
                break;
            }
        }
        return params;
    }

    private parseBlock(tokens: Token[]): Ast.Block {
        this.expect("LeftBrace", tokens);
        const blockItems = [];
        while (this.peek(tokens).type !== "RightBrace") {
            const nextBlockItem = this.parseBlockItem(tokens);
            blockItems.push(nextBlockItem);
        }
        this.takeToken(tokens);
        return { tag: "block", blockItems };
    }

    private parseTypeAndStorageClass(specifierList: Token[]): { type: Type, storageClass?: Ast.StorageClass } {
        const types: Token[] = [];
        const storageClasses: Token[] = [];
        specifierList.forEach(specifier => {
            if (specifier.type === "Int") {
                types.push(specifier);
            } else {
                storageClasses.push(specifier);
            }
        });

        if (types.length !== 1) throw new Error("Invalid type specifier");

        if (storageClasses.length > 1) {
            throw new Error("Invalid storage class");
        }

        const type: Type = { tag: "int" };

        if (storageClasses.length === 1) {
            switch (storageClasses[0].type) {
                case "Static": return { type: type, storageClass: "Static" };
                case "Extern": return { type: type, storageClass: "Extern" };
                default:
                    throw new Error(`Invalid storage class ${storageClasses[0]}`);
            }
        }

        return { type: type, storageClass: undefined };
    }

    private parseDeclaration(tokens: Token[]): Ast.Declaration {
        const specifiers: Token[] = [];

        while (this.isTypeSpecifier(this.peek(tokens))) {
            specifiers.push(this.takeToken(tokens));
        }

        const typeAndStorageClass = this.parseTypeAndStorageClass(specifiers);

        const token = this.takeToken(tokens);
        if (token.type !== "Identifier") throw new Error("Syntax Error");

        let exp = undefined;

        switch (this.peek(tokens).type) {
            case "LeftParen": {
                this.expect("LeftParen", tokens);
                const params = this.parseParamList(tokens);
                this.expect("RightParen", tokens);
                let body = undefined;
                if (this.peek(tokens).type === "Semicolon") {
                    this.expect("Semicolon", tokens);
                } else {
                    body = this.parseBlock(tokens);
                }

                return {
                    tag: "fundecl",
                    name: token.lexeme,
                    params,
                    body,
                    storageClass: typeAndStorageClass.storageClass
                };
            }
            case "Equal": {
                this.expect("Equal", tokens);
                exp = this.parseExp(tokens);
                break;
            }
        }

        this.expect("Semicolon", tokens);

        return { tag: "vardecl", name: token.lexeme, init: exp, storageClass: typeAndStorageClass.storageClass };
    }

    private isTypeSpecifier(token: Token): boolean {
        return (token.type === "Int" || token.type === "Static" || token.type === "Extern") ? true : false;
    }

    private parseBlockItem(tokens: Token[]): Ast.BlockItem {
        if (this.isTypeSpecifier(this.peek(tokens))) {
            return this.parseDeclaration(tokens);
        } else {
            return this.parseStatement(tokens);
        }
    }

    private parseStatement(tokens: Token[]): Ast.Statement {
        const nextToken = this.peek(tokens);
        switch (nextToken.type) {
            case "Return": {
                this.expect("Return", tokens);
                const expression = this.parseExp(tokens);
                this.expect("Semicolon", tokens);
                return { tag: "return", expression };
            }
            case "If": {
                this.takeToken(tokens);
                this.expect("LeftParen", tokens);
                const condition = this.parseExp(tokens);
                this.expect("RightParen", tokens);
                const thenClause = this.parseStatement(tokens);
                let elseClause;
                if (this.peek(tokens).type === "Else") {
                    this.takeToken(tokens);
                    elseClause = this.parseStatement(tokens);
                }
                return { tag: "if", condition, then: thenClause, else: elseClause };
            }
            case "Semicolon": {
                this.takeToken(tokens);
                return { tag: "null" };
            }
            case "LeftBrace": {
                const block = this.parseBlock(tokens);
                return { tag: "compound", block };
            }
            case "Break": {
                this.takeToken(tokens);
                this.expect("Semicolon", tokens);
                return { tag: "break", identifier: "" };
            }
            case "Continue": {
                this.takeToken(tokens);
                this.expect("Semicolon", tokens);
                return { tag: "continue", identifier: "" };
            }
            case "While": {
                this.takeToken(tokens);
                this.expect("LeftParen", tokens);
                const condition = this.parseExp(tokens);
                this.expect("RightParen", tokens);
                const body = this.parseStatement(tokens);
                return { tag: "while", condition, body, identifier: "" };
            }
            case "Do": {
                this.takeToken(tokens);
                const body = this.parseStatement(tokens);
                this.expect("While", tokens);
                this.expect("LeftParen", tokens);
                const condition = this.parseExp(tokens);
                this.expect("RightParen", tokens);
                this.expect("Semicolon", tokens);
                return { tag: "dowhile", condition, body, identifier: "" };
            }
            case "For": {
                this.takeToken(tokens);
                this.expect("LeftParen", tokens);
                const forInit = this.parseForInit(tokens);
                const condition = this.parseOptionalExp(tokens, "Semicolon");
                const post = this.parseOptionalExp(tokens, "RightParen");
                const body = this.parseStatement(tokens);
                return { tag: "for", forInit, condition, post, body, identifier: "" };
            }
            default: {
                const expression = this.parseExp(tokens);
                this.expect("Semicolon", tokens);
                return { tag: "expression", expression };
            }
        }
    }

    private parseOptionalExp(tokens: Token[], delimiter: TokenType): Ast.Exp | undefined {
        let exp = undefined;
        if (this.peek(tokens).type === delimiter) {
            this.takeToken(tokens);
        } else {
            exp = this.parseExp(tokens);
            this.expect(delimiter, tokens);
        }
        return exp;
    }

    private parseForInit(tokens: Token[]): Ast.ForInit {
        if (this.isTypeSpecifier(this.peek(tokens))) {
            const declaration = this.parseDeclaration(tokens);
            switch (declaration.tag) {
                case "vardecl":
                    return { tag: "initdecl", declaration };
                default: throw new Error("Found a function declaration in a for loop header.");
            }
        }
        const exp = this.parseOptionalExp(tokens, "Semicolon");
        return { tag: "initexp", exp };
    }

    private parseExp(tokens: Token[], minPrec: number = 0): Ast.Exp {
        let left = this.parseFactor(tokens);
        let nextToken = this.peek(tokens);
        while (this.precedence.has(nextToken.type) && this.precedence.get(nextToken.type)! >= minPrec) {
            if (nextToken.type === "Equal") {
                this.takeToken(tokens);
                const right = this.parseExp(tokens, this.precedence.get(nextToken.type)!);
                left = { tag: "assignment", left, right };
            } else if (nextToken.type === "TernaryIf") {
                const middle = this.parseConditionalMiddle(tokens);
                const right = this.parseExp(tokens, this.precedence.get(nextToken.type));
                left = { tag: "conditional", condition: left, then: middle, else: right };
            } else {
                const operator = this.parseBinaryOp(tokens);
                const right = this.parseExp(tokens, this.precedence.get(nextToken.type)! + 1);
                left = { tag: "binary", operator, left, right };
            }
            nextToken = this.peek(tokens);
        }
        return left;
    }

    private parseConditionalMiddle(tokens: Token[]): Ast.Exp {
        this.expect("TernaryIf", tokens);
        const exp = this.parseExp(tokens);
        this.expect("TernaryElse", tokens);
        return exp;
    }

    private parseBinaryOp(tokens: Token[]): Ast.BinaryOp {
        const token = this.takeToken(tokens);
        switch (token.type) {
            case "Hyphen": return "Subtract";
            case "Plus": return "Add";
            case "Star": return "Multiply";
            case "Slash": return "Divide";
            case "Percent": return "Remainder";
            case "AmpersandAmpersand": return "And";
            case "VerticalBarVerticalBar": return "Or";
            case "EqualEqual": return "Equal";
            case "BangEqual": return "NotEqual";
            case "LessThan": return "LessThan";
            case "LessThanEqual": return "LessOrEqual";
            case "MoreThan": return "GreaterThan";
            case "MoreThanEqual": return "GreaterOrEqual";
            case "Equal": return "Equal";
            default: throw new Error("Syntax Error");
        }
    }

    private parseArgumentList(tokens: Token[]): Ast.Exp[] {
        const args: Ast.Exp[] = [];
        args.push(this.parseExp(tokens));
        while (this.peek(tokens).type === "Comma") {
            this.takeToken(tokens);
            args.push(this.parseExp(tokens));
        }
        return args;
    }

    private parseFactor(tokens: Token[]): Ast.Exp {
        const nextToken = this.peek(tokens);
        switch (nextToken.type) {
            case "Constant":
                this.takeToken(tokens);
                return { tag: "constant", value: parseInt(nextToken.lexeme) };
            case "Identifier": {
                const token = this.takeToken(tokens);
                if (this.peek(tokens).type === "LeftParen") {
                    this.takeToken(tokens);
                    let args: Ast.Exp[] = [];
                    if (this.peek(tokens).type !== "RightParen") {
                        args = this.parseArgumentList(tokens);
                    }
                    this.expect("RightParen", tokens);
                    return { tag: "functioncall", name: token.lexeme, args };
                }
                return { tag: "var", identifier: token.lexeme };
            }
            case "Bang":
            case "Tilde":
            case "Hyphen": {
                const operator = this.parseUnaryOp(tokens);
                const expression = this.parseFactor(tokens);
                return { tag: "unary", operator, expression };
            }
            case "LeftParen": {
                this.takeToken(tokens);
                const expression = this.parseExp(tokens);
                this.expect("RightParen", tokens);
                return expression;
            }
            default: throw new Error("Syntax Error");
        }
    }

    private parseUnaryOp(tokens: Token[]): Ast.UnaryOp {
        const token = this.takeToken(tokens);
        switch (token.type) {
            case "Tilde": return "Complement";
            case "Hyphen": return "Negate";
            case "Bang": return "Not";
            default: throw new Error("Syntax Error");
        }
    }

    private peek(tokens: Token[]): Token {
        return tokens[0];
    }

    private expect(expected: TokenType, tokens: Token[]): void {
        const actual = this.takeToken(tokens);
        if (actual.type !== expected) throw new Error("Syntax Error");
    }

    private takeToken(tokens: Token[]): Token {
        const token = tokens[0];
        tokens.shift();
        return token;
    }
};

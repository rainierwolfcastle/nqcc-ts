import { TokenType, Token } from "./Token.ts";

export class Scan {
    private keywords: Map<string, TokenType>;
    private source: string;
    private tokens: Token[] = [];
    private start = 0;
    private current = 0;

    constructor(source: string) {
        this.source = source;

        this.keywords = new Map();
        this.keywords.set("int", "Int");
        this.keywords.set("void", "Void");
        this.keywords.set("return", "Return");
        this.keywords.set("if", "If");
        this.keywords.set("else", "Else");
        this.keywords.set("do", "Do");
        this.keywords.set("while", "While");
        this.keywords.set("for", "For");
        this.keywords.set("break", "Break");
        this.keywords.set("continue", "Continue");
        this.keywords.set("static", "Static");
        this.keywords.set("extern", "Extern");
    }

    scanTokens(): Token[] {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        return this.tokens;
    };

    private scanToken(): void {
        const c = this.advance();
        switch (c) {
            case "(": this.addToken("LeftParen"); break;
            case ")": this.addToken("RightParen"); break;
            case "{": this.addToken("LeftBrace"); break;
            case "}": this.addToken("RightBrace"); break;
            case "+": this.addToken("Plus"); break;
            case ";": this.addToken("Semicolon"); break;
            case "/": this.addToken("Slash"); break;
            case "*": this.addToken("Star"); break;
            case "~": this.addToken("Tilde"); break;
            case "-": {
                if (this.match("-")) {
                    throw new Error("Unexpected character.");
                } else {
                    this.addToken("Hyphen");
                }
                break;
            }
            case "%": this.addToken("Percent"); break;
            case "!": this.addToken(this.match("=") ? "BangEqual" : "Bang"); break;
            case "=": this.addToken(this.match("=") ? "EqualEqual" : "Equal"); break;
            case "&": {
                if (this.match("&")) {
                    this.addToken("AmpersandAmpersand");
                } else {
                    throw new Error("Unexpected character.");
                }
                break;
            }
            case "|": {
                if (this.match("|")) {
                    this.addToken("VerticalBarVerticalBar");
                } else {
                    throw new Error("Unexpected character.");
                }
                break;
            }
            case "<": this.addToken(this.match("=") ? "LessThanEqual" : "LessThan"); break;
            case ">": this.addToken(this.match("=") ? "MoreThanEqual" : "MoreThan"); break;
            case "?": this.addToken("TernaryIf"); break;
            case ":": this.addToken("TernaryElse"); break;
            case ",": this.addToken("Comma"); break;
            case " ":
            case "\r":
            case "\t":
            case "\b":
            case "\n":
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                } else if (this.isAlpha(c)) {
                    this.identifier();
                } else {
                    throw new Error("Unexpected character.");
                }
                break;
        }
    }

    private identifier(): void {
        while (this.isAlphaNumeric(this.peek())) this.advance();

        const text = this.source.substring(this.start, this.current);
        let type = this.keywords.get(text);
        if (type === undefined) type = "Identifier";
        this.addToken(type);
    }

    private number(): void {
        while (this.isDigit(this.peek())) this.advance();
        this.addToken("Constant");
    }

    private match(expected: string): boolean {
        if (this.isAtEnd()) return false;
        if (this.source.charAt(this.current) !== expected) return false;

        this.current++;
        return true;
    }

    private peek(): string {
        if (this.isAtEnd()) return "\0";
        return this.source.charAt(this.current);
    }

    private peekNext(): string {
        if (this.current + 1 >= this.source.length) return "\0";
        return this.source.charAt(this.current + 1);
    }

    private isAlpha(c: string): boolean {
        return (c.charCodeAt(0) >= "a".charCodeAt(0) && c.charCodeAt(0) <= "z".charCodeAt(0)) ||
            (c.charCodeAt(0) >= "A".charCodeAt(0) && c.charCodeAt(0) <= "Z".charCodeAt(0)) ||
            c.charCodeAt(0) === "_".charCodeAt(0);
    }

    private isAlphaNumeric(c: string): boolean {
        return this.isAlpha(c) || this.isDigit(c);
    }

    private isDigit(c: string): boolean {
        return c.charCodeAt(0) >= "0".charCodeAt(0) && c.charCodeAt(0) <= "9".charCodeAt(0);
    }

    private isAtEnd(): boolean {
        return this.current >= this.source.length;
    }

    private advance(): string {
        return this.source.charAt(this.current++);
    }

    private addToken(type: TokenType): void {
        const lexeme = this.source.substring(this.start, this.current);
        this.tokens.push({ type, lexeme });
    }
}

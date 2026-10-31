// Obiectele de intrare validate cu class-validator (ValidationPipe global).
// Structurile criptografice (buletin, dovezi) se validează în profunzime de
// @evoting/crypto, așa că aici se verifică doar forma lor de bază.

import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

const HEX64 = /^[0-9a-f]{64}$/
const HEX128 = /^[0-9a-f]{128}$/
const hexMsg = (what: string, n = 64) => ({ message: `${what} trebuie să fie hex, ${n} de caractere` })

export class CandidateInput {
  @IsString() @MinLength(1) @MaxLength(120) name!: string
  @IsString() @MaxLength(300) description!: string
}

export class TrusteeInput {
  @IsString() @MinLength(1) @MaxLength(120) name!: string
}

export class CreateElectionDto {
  @IsString() @MinLength(3, { message: 'Titlul este obligatoriu (cel puțin 3 caractere)' }) @MaxLength(200) title!: string
  @IsDateString() opensAt!: string
  @IsDateString() closesAt!: string
  @IsArray() @ArrayMinSize(2, { message: 'Sunt necesari cel puțin doi candidați' }) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => CandidateInput)
  candidates!: CandidateInput[]
  @IsArray() @ArrayMinSize(1, { message: 'Este necesar cel puțin un trustee' }) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => TrusteeInput)
  trustees!: TrusteeInput[]
  @IsOptional() @IsInt() @Min(0) minSelections?: number
  @IsOptional() @IsInt() @Min(1) @Max(50) maxSelections?: number
}

export class CompactProofDto {
  @Matches(HEX64, hexMsg('c')) c!: string
  @Matches(HEX64, hexMsg('z')) z!: string
}

export class TrusteeKeyDto {
  @IsString() @MaxLength(40) trusteeId!: string
  @Matches(HEX64, hexMsg('publicKeyShare')) publicKeyShare!: string
  @ValidateNested() @Type(() => CompactProofDto) proof!: CompactProofDto
}

export class RegisterOcrDto {
  @IsString() @Matches(/^\d{13}$/, { message: 'CNP-ul are exact 13 cifre' }) cnp!: string
  @Matches(HEX64, hexMsg('credentialPubkey')) credentialPubkey!: string
}

export class RegisterNfcDto {
  @IsString() @MaxLength(4096) dg1!: string
  @IsString() @MaxLength(65536) sod!: string
  @Matches(HEX64, hexMsg('credentialPubkey')) credentialPubkey!: string
}

export class AuthChallengeDto {
  @IsString() @MaxLength(80) electionId!: string
  @Matches(HEX64, hexMsg('credentialPubkey')) credentialPubkey!: string
}

export class AuthVerifyDto extends AuthChallengeDto {
  @Matches(HEX64, hexMsg('nonce')) nonce!: string
  @Matches(HEX128, hexMsg('signature', 128)) signature!: string
}

export class AdminLoginDto {
  @IsString() @MaxLength(200) password!: string
}

/** Buletinul: forma de bază; dovezile se verifică de @evoting/crypto. */
export class BallotDto {
  @IsString() @MaxLength(80) electionId!: string
  @Matches(HEX64, hexMsg('credentialPubkey')) credentialPubkey!: string
  @IsArray() @ArrayMaxSize(50) ciphertexts!: { a: string; b: string }[]
  @IsObject() proofs!: { selections: { c: string[]; z: string[] }[]; count: { c: string[]; z: string[] } }
  @Matches(HEX128, hexMsg('signature', 128)) signature!: string
}

export class PartialDecryptionDto {
  @IsString() @MaxLength(40) trusteeId!: string
  @IsArray() @ArrayMaxSize(50) shares!: { d: string; proof: { c: string; z: string } }[]
}

export class CountDto {
  @IsInt() @Min(1) @Max(5000) count!: number
}

import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateLayerDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

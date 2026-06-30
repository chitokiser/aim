import { Module } from '@nestjs/common';
import { CoupangController } from './coupang.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [FirebaseModule, UsersModule, AuthModule],
  controllers: [CoupangController],
})
export class CoupangModule {}

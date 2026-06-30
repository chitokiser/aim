import { Module } from '@nestjs/common';
import { CoupangController } from './coupang.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FirebaseModule, UsersModule],
  controllers: [CoupangController],
})
export class CoupangModule {}

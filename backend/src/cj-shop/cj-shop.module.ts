import { Module } from '@nestjs/common';
import { CjShopController } from './cj-shop.controller';
import { CjShopService } from './cj-shop.service';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, PointsModule, UsersModule],
  controllers: [CjShopController],
  providers: [CjShopService],
})
export class CjShopModule {}

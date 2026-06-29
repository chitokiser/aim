import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

@Controller('admin/stats')
export class AdminStatsController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly users: UsersService,
  ) {}

  private async assertAdmin(userId: string) {
    if (!(await this.users.isAdminUser(userId))) throw new ForbiddenException();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: { user: { sub: string } }) {
    await this.assertAdmin(req.user.sub);

    const [usersSnap, activeMissionsSnap, pendingWithdrawalsSnap, pendingSubmissionsSnap] =
      await Promise.all([
        this.firebase.collection('users').select('points').get(),
        this.firebase.collection('missions').where('status', '==', 'active').select().get(),
        this.firebase.collection('withdrawals').where('status', '==', 'pending').select().get(),
        this.firebase.collection('submissions').where('status', '==', 'pending').select().get(),
      ]);

    const totalMembers = usersSnap.size;
    const totalApIssued = usersSnap.docs.reduce(
      (sum, doc) => sum + (((doc.data() as { points?: number }).points) ?? 0),
      0,
    );
    const activeMissions = activeMissionsSnap.size;
    const pendingWithdrawals = pendingWithdrawalsSnap.size;
    const pendingSubmissions = pendingSubmissionsSnap.size;

    return {
      totalMembers,
      activeMissions,
      totalApIssued,
      pendingWithdrawals,
      pendingSubmissions,
      pendingItems: pendingWithdrawals + pendingSubmissions,
    };
  }
}

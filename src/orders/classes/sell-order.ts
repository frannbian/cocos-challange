import { UsersService } from '../../users/users.service';
import { AbstractOrder } from './abstract-order';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { InstrumentsService } from '../../instruments/instruments.service';
import { OrderStatus } from '../order.entity';
import { MarketDataService } from '../../market-data/market-data.service';

export class SellOrder extends AbstractOrder {
  constructor(
    protected readonly instrumentsService: InstrumentsService,
    protected readonly usersService: UsersService,
    protected readonly marketDataService: MarketDataService,
  ) {
    super(instrumentsService, usersService, marketDataService);
  }

  async handleOrderPrice(
    createOrderDto: CreateOrderDto,
  ): Promise<number | undefined> {
    const instrument = await this.instrumentsService.findOne(
      createOrderDto.instrumentId,
    );
    const marketData =
      await this.marketDataService.findOneByInstrument(instrument);

    return marketData.close * createOrderDto.size;
  }

  handleOrderSize(createOrderDto: CreateOrderDto): Promise<number> | number {
    return createOrderDto.size;
  }

  async handleOrderStatus(
    createOrderDto: CreateOrderDto,
  ): Promise<OrderStatus> {
    if (!(await this.isValidTransaction(createOrderDto))) {
      return OrderStatus.REJECTED;
    }
    return OrderStatus.FILLED;
  }

  protected async isValidTransaction(
    createOrderDto: CreateOrderDto,
  ): Promise<boolean> {
    const availableInstrument = await this.usersService.getAvailableInstrument(
      createOrderDto.userId,
      createOrderDto.instrumentId,
    );

    if (availableInstrument < createOrderDto.size) {
      return false;
    }

    return true;
  }
}

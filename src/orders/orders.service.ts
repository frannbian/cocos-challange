import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dtos/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderSide, OrderType, OrderStatus } from './order.entity';
import { UsersService } from '../users/users.service';
import { InstrumentsService } from '../instruments/instruments.service';
import { MarketDataService } from '../market-data/market-data.service';
import { CashInOrder } from './classes/cash-in-order';
import { CashOutOrder } from './classes/cash-out-order';
import { AbstractOrder } from './classes/abstract-order';
import { BuyMarketOrder } from './classes/buy-market-order';
import { BuyLimitOrder } from './classes/buy-limit-order';
import { SellOrder } from './classes/sell-order';
import { InstrumentCurrencyId } from '../instruments/instrument.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly instrumentsService: InstrumentsService,
    private readonly usersService: UsersService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async findAll(): Promise<Order[]> {
    return await this.orderRepository.find({
      relations: ['user', 'instrument'],
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'instrument'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const newOrder = await this.createOrder(createOrderDto, false);

    // Automatically create cash_in or cash_out order for buy/sell orders
    if (
      createOrderDto.side === OrderSide.BUY ||
      createOrderDto.side === OrderSide.SELL
    ) {
      const autoOrderDto = {
        ...createOrderDto,
        size: Math.round(newOrder.price),
        instrumentId: InstrumentCurrencyId,
        side:
          createOrderDto.side === OrderSide.BUY
            ? OrderSide.CASH_OUT
            : OrderSide.CASH_IN,
      };
      await this.createOrder(autoOrderDto, true, newOrder.id);
    }

    return newOrder;
  }

  private async createOrder(
    createOrderDto: CreateOrderDto,
    isComputed: boolean,
    parentOrderId?: number,
  ): Promise<Order> {
    const newOrder = this.orderRepository.create(createOrderDto);

    const orderClass: AbstractOrder = this.getOrderStrategy(createOrderDto);

    newOrder.user = await orderClass.handleOrderUser(createOrderDto);
    newOrder.instrument =
      await orderClass.handleOrderInstrument(createOrderDto);

    const orderPrice = await orderClass.handleOrderPrice(createOrderDto);
    if (orderPrice) {
      newOrder.price = orderPrice;
    }

    newOrder.size = await orderClass.handleOrderSize(createOrderDto, newOrder);
    newOrder.status = await orderClass.handleOrderStatus(
      createOrderDto,
      orderPrice,
    );
    newOrder.datetime = new Date();
    newOrder.is_computed = isComputed;

    if (parentOrderId) {
      newOrder.parent_order_id = parentOrderId;
    }

    return await this.orderRepository.save(newOrder);
  }

  async update(id: number, attrs: Partial<Order>): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, attrs);
    return this.orderRepository.save(order);
  }

  async remove(id: number): Promise<Order> {
    const order = await this.findOne(id);
    await this.orderRepository.remove(order);
    return order;
  }

  async cancelOrder(id: number): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status !== OrderStatus.NEW) {
      throw new Error('Only orders with status "NEW" can be cancelled');
    }

    order.status = OrderStatus.CANCELLED;
    return this.orderRepository.save(order);
  }

  private getOrderStrategy(createOrderDto: CreateOrderDto): AbstractOrder {
    switch (createOrderDto.side) {
      case OrderSide.CASH_IN:
        return new CashInOrder(this.instrumentsService, this.usersService);
      case OrderSide.CASH_OUT:
        return new CashOutOrder(this.instrumentsService, this.usersService);
      case OrderSide.SELL:
        return new SellOrder(
          this.instrumentsService,
          this.usersService,
          this.marketDataService,
        );
      case OrderSide.BUY:
        if (createOrderDto.type === OrderType.MARKET) {
          return new BuyMarketOrder(
            this.instrumentsService,
            this.usersService,
            this.marketDataService,
          );
        }
        return new BuyLimitOrder(
          this.instrumentsService,
          this.usersService,
          this.marketDataService,
        );
    }
  }
}

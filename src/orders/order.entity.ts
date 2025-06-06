import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Instrument } from '../instruments/instrument.entity'; // Adjust the path as needed
import { User } from '../users/user.entity'; // Adjust the path as needed

export enum OrderStatus {
  NEW = 'NEW',
  FILLED = 'FILLED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
}
export enum SizeType {
  CASH = 'CASH',
  QUANTITY = 'QUANTITY',
}
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Instrument)
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  size: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ length: 10 })
  type: OrderType;

  @Column({ length: 10 })
  side: OrderSide;

  @Column({ length: 20 })
  status: OrderStatus;

  @Column()
  datetime: Date;

  @Column({ default: false })
  is_computed: boolean;

  @Column({ nullable: true })
  parent_order_id: number;
}

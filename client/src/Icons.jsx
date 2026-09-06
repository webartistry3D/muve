import React from 'react';
import {
  Car, Clock, BarChart3, User, Settings2,
  Bell, MapPin, Globe, Ruler, Zap, Star,
  FileText, Lock, HelpCircle, CreditCard, Banknote,
  Plus, Trash2, Wrench, Eye, EyeOff,
  Fuel, Wrench as WrenchIcon, ShieldCheck, Package, Banknote as MoneyIcon,
} from 'lucide-react';

const iconMap = {
  car: Car,
  clock: Clock,
  chart: BarChart3,
  user: User,
  gear: Settings2,
  bell: Bell,
  pin: MapPin,
  globe: Globe,
  ruler: Ruler,
  zap: Zap,
  star: Star,
  file: FileText,
  lock: Lock,
  help: HelpCircle,
  card: CreditCard,
  cash: Banknote,
  plus: Plus,
  trash: Trash2,
  wrench: Wrench,
  eye: Eye,
  eyeOff: EyeOff,
  fuel: Fuel,
  shield: ShieldCheck,
  package: Package,
  money: MoneyIcon,
};

export const Icon = ({ name, size = 22 }) => {
  const Cmp = iconMap[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
};

export default Icon;

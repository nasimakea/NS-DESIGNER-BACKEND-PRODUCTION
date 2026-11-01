import Order from "@/models/Order";
import CustomOrder from "@/models/CustomOrder";
import FranchiseInquiry from "@/models/FranchiseInquiry";
import ContactMessage from "@/models/ContactMessage";
import Notification from "@/models/Notification";
import ChatConversation from "@/models/ChatConversation";
import { route } from "@/lib/route";

// Sidebar badges + bell count.
export const GET = route(
  async () => {
    const [orders, customOrders, franchise, messages, unread, chats] = await Promise.all([
      Order.countDocuments({ status: "Order Received" }),
      CustomOrder.countDocuments({ status: "New" }),
      FranchiseInquiry.countDocuments({ status: "New" }),
      ContactMessage.countDocuments({ status: "New" }),
      Notification.countDocuments({ read: false }),
      ChatConversation.countDocuments({ status: "handover", unreadForAdmin: true }),
    ]);
    return { orders, customOrders, franchise, messages, unreadNotifications: unread, chats };
  },
  { auth: true }
);

import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import productRoutes from '../../modules/products/routes/product.routes';
import categoryRoutes from '../../modules/categories/routes/category.routes';
import sellerRoutes from '../../modules/sellers/routes/seller.routes';
import inventoryRoutes from '../../modules/inventory/routes/inventory.routes';
import cartRoutes from '../../modules/cart/routes/cart.routes';
import wishlistRoutes from '../../modules/wishlist/routes/wishlist.routes';
import orderRoutes from '../../modules/orders/routes/order.routes';
import paymentRoutes from '../../modules/payments/routes/payment.routes';
import shippingRoutes from '../../modules/shipping/routes/shipping.routes';
import reviewRoutes from '../../modules/reviews/routes/review.routes';
import notificationRoutes from '../../modules/notifications/routes/notification.routes';
import adminRoutes from '../../modules/admin/routes/admin.routes';
import userRoutes from '../../modules/users/routes/user.routes';
import searchRoutes from '../../modules/products/routes/search.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products/search', searchRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/sellers', sellerRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/shipping', shippingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;

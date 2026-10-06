-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for procedure icleaners.reset_all_auto_increment
DELIMITER //
CREATE PROCEDURE `reset_all_auto_increment`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE tname VARCHAR(255);
    DECLARE cname VARCHAR(255);
    DECLARE cur CURSOR FOR 
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND extra LIKE '%auto_increment%';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO tname, cname;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET @sql1 = CONCAT('SET @num := 0');
        PREPARE stmt1 FROM @sql1;
        EXECUTE stmt1;
        DEALLOCATE PREPARE stmt1;

        SET @sql2 = CONCAT('UPDATE `', tname, '` SET `', cname, '` = @num := (@num + 1)');
        PREPARE stmt2 FROM @sql2;
        EXECUTE stmt2;
        DEALLOCATE PREPARE stmt2;

        SET @sql3 = CONCAT('ALTER TABLE `', tname, '` AUTO_INCREMENT = 1');
        PREPARE stmt3 FROM @sql3;
        EXECUTE stmt3;
        DEALLOCATE PREPARE stmt3;

    END LOOP;

    CLOSE cur;
END//
DELIMITER ;

-- Dumping structure for table icleaners.tbl_account
CREATE TABLE IF NOT EXISTS `tbl_account` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ac_name` varchar(255) NOT NULL,
  `ac_number` varchar(255) NOT NULL,
  `ac_decrip` varchar(255) NOT NULL,
  `store_ID` varchar(255) NOT NULL,
  `balance` float NOT NULL DEFAULT '0',
  `store_name` varchar(255) NOT NULL,
  `delet_flage` varchar(255) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_account: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_addons
CREATE TABLE IF NOT EXISTS `tbl_addons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `addon` varchar(45) NOT NULL,
  `price` float NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_addons: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_admin
CREATE TABLE IF NOT EXISTS `tbl_admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `number` varchar(45) NOT NULL,
  `email` varchar(45) NOT NULL,
  `username` varchar(45) NOT NULL,
  `password` longtext NOT NULL,
  `store_ID` varchar(45) NOT NULL DEFAULT '0',
  `roll_id` varchar(45) NOT NULL DEFAULT '0',
  `approved` varchar(45) NOT NULL DEFAULT '0',
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `img` varchar(255) DEFAULT NULL,
  `is_staff` varchar(45) DEFAULT '0',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_admin: ~1 rows (approximately)
INSERT INTO `tbl_admin` (`id`, `name`, `number`, `email`, `username`, `password`, `store_ID`, `roll_id`, `approved`, `delet_flage`, `img`, `is_staff`, `reset_token`, `reset_token_expires`) VALUES
	(1, 'Super Admin', '591', 'vifa@mailinator.com', 'admin', '$2b$10$Kcy3ygObycEoThshBB1nZebfcYeq4szHbHsyI7065mukEoGSsZoyG', '', '1', '1', '0', NULL, '0', NULL, NULL);

-- Dumping structure for table icleaners.tbl_cart
CREATE TABLE IF NOT EXISTS `tbl_cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_by` varchar(45) NOT NULL DEFAULT '0',
  `store_id` varchar(45) NOT NULL DEFAULT '0',
  `customer_id` varchar(45) NOT NULL DEFAULT '0',
  `order_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `service_list_id` varchar(255) NOT NULL DEFAULT '0',
  `order_id` varchar(255) NOT NULL DEFAULT '0',
  `addon_id` varchar(255) NOT NULL DEFAULT '0',
  `addon_price` float NOT NULL DEFAULT '0',
  `delivery_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `extra_discount` float NOT NULL DEFAULT '0',
  `coupon_id` varchar(255) NOT NULL DEFAULT '0',
  `coupon_discount` float NOT NULL DEFAULT '0',
  `tax` float DEFAULT NULL,
  `sub_total` float NOT NULL DEFAULT '0',
  `gross_total` float NOT NULL DEFAULT '0',
  `paid_amount` float NOT NULL DEFAULT '0',
  `payment_type` varchar(255) NOT NULL DEFAULT '0',
  `balance` float NOT NULL DEFAULT '0',
  `notes` varchar(255) NOT NULL DEFAULT ' ',
  `tax_amount` float NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_cart: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_cart_servicelist
CREATE TABLE IF NOT EXISTS `tbl_cart_servicelist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_id` varchar(255) NOT NULL,
  `service_type_id` varchar(255) NOT NULL,
  `service_type_price` float NOT NULL,
  `service_quntity` int NOT NULL,
  `service_color` varchar(255) NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `service_type_name` varchar(255) NOT NULL,
  `service_img` varchar(255) NOT NULL DEFAULT ' ',
  `no_of_items` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_cart_servicelist: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_commision
CREATE TABLE IF NOT EXISTS `tbl_commision` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `amount` float DEFAULT NULL,
  `from_account` varchar(255) DEFAULT NULL,
  `to_account` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `store_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_commision: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_coupon
CREATE TABLE IF NOT EXISTS `tbl_coupon` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `min_purchase` float NOT NULL,
  `discount` float NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `store_list_id` varchar(255) NOT NULL DEFAULT '1',
  `coupon_type` varchar(255) NOT NULL,
  `limit_forsame_user` int NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_coupon: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_customer
CREATE TABLE IF NOT EXISTS `tbl_customer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `number` varchar(45) DEFAULT NULL,
  `email` varchar(45) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `taxnumber` varchar(45) DEFAULT NULL,
  `username` varchar(45) DEFAULT NULL,
  `password` longtext,
  `img` varchar(255) DEFAULT '',
  `store_ID` varchar(45) NOT NULL DEFAULT ' ',
  `main_roll_id` varchar(45) DEFAULT NULL,
  `reffstore` varchar(45) NOT NULL DEFAULT '',
  `approved` int NOT NULL DEFAULT '0',
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_customer: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_email
CREATE TABLE IF NOT EXISTS `tbl_email` (
  `id` int NOT NULL AUTO_INCREMENT,
  `store_id` varchar(255) DEFAULT NULL,
  `host` varchar(255) DEFAULT NULL,
  `port` varchar(255) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `frommail` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_email: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_expense
CREATE TABLE IF NOT EXISTS `tbl_expense` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `amount` float NOT NULL,
  `towards` varchar(255) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `taxInclud` varchar(255) NOT NULL,
  `payment_mode` varchar(255) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `delet_flage` varchar(255) NOT NULL DEFAULT '0',
  `store_ID` varchar(255) DEFAULT '1',
  `taxpercent` int DEFAULT '0',
  `transection_id` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_expense: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_exp_cat
CREATE TABLE IF NOT EXISTS `tbl_exp_cat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exp_cat_type_id` varchar(45) NOT NULL,
  `cat_name` varchar(255) NOT NULL,
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_exp_cat: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_exp_cat_type
CREATE TABLE IF NOT EXISTS `tbl_exp_cat_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(255) NOT NULL,
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_exp_cat_type: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_master_shop
CREATE TABLE IF NOT EXISTS `tbl_master_shop` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(45) NOT NULL,
  `customer_selection` varchar(45) DEFAULT NULL,
  `currency_symbol` varchar(255) DEFAULT NULL,
  `currency_placement` int DEFAULT '0',
  `thousands_separator` varchar(45) DEFAULT NULL,
  `customer_autoapprove` int DEFAULT '0',
  `store_autoapprove` int DEFAULT '0',
  `timezone` varchar(255) DEFAULT NULL,
  `printer` int DEFAULT '0',
  `storeroll` int DEFAULT '0',
  `app_logo` varchar(255) DEFAULT NULL,
  `app_favicon` varchar(255) DEFAULT NULL,
  `app_name` varchar(255) DEFAULT NULL,
  `onesignal_app_id` varchar(255) DEFAULT NULL,
  `onesignal_api_key` varchar(255) DEFAULT NULL,
  `twilio_sid` varchar(255) DEFAULT NULL,
  `twilio_auth_token` varchar(255) DEFAULT NULL,
  `twilio_phone_no` varchar(255) DEFAULT NULL,
  `fromStore` varchar(45) DEFAULT NULL,
  `footer` longtext,
  `invoice_printer_format` int DEFAULT '1',
  `invoice_printer_name` varchar(255) DEFAULT '',
  `tag_printer_format` int DEFAULT '0',
  `tag_printer_name` varchar(255) DEFAULT '',
  `printing_server_url` varchar(255) DEFAULT 'http://127.0.0.1:4321',
  `silent_print_enabled` tinyint(1) DEFAULT '1',
  `printer_auto_cut` tinyint(1) DEFAULT '1',
  `printer_open_cash_drawer` tinyint(1) DEFAULT '0',
  `printer_copies` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_master_shop: ~1 rows (approximately)
INSERT INTO `tbl_master_shop` (`id`, `type`, `customer_selection`, `currency_symbol`, `currency_placement`, `thousands_separator`, `customer_autoapprove`, `store_autoapprove`, `timezone`, `printer`, `storeroll`, `app_logo`, `app_favicon`, `app_name`, `onesignal_app_id`, `onesignal_api_key`, `twilio_sid`, `twilio_auth_token`, `twilio_phone_no`, `fromStore`, `footer`, `invoice_printer_format`, `invoice_printer_name`, `tag_printer_format`, `tag_printer_name`, `printing_server_url`, `silent_print_enabled`, `printer_auto_cut`, `printer_open_cash_drawer`, `printer_copies`) VALUES
	(1, '1', '1', '$', 0, '1', 1, 1, 'Asia/Karachi', 1, 12, '1789544344016-1000066546 (1).png', '1789544584897-1000066546 (1)jh.png', 'iCleaners', '', '', '', '', '', '', 'Copyright 2026 © iCleaners', 1, 'Microsoft Print to PDF', 1, 'Microsoft Print to PDF', 'http://127.0.0.1:4321', 1, 1, 0, 1);

-- Dumping structure for table icleaners.tbl_notification
CREATE TABLE IF NOT EXISTS `tbl_notification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice` varchar(45) NOT NULL,
  `date` varchar(45) NOT NULL,
  `sender` varchar(45) NOT NULL,
  `received` varchar(45) NOT NULL,
  `notification` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_notification: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_order
CREATE TABLE IF NOT EXISTS `tbl_order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` varchar(255) DEFAULT NULL,
  `order_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `delivery_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `order_status` int DEFAULT NULL,
  `service_list` varchar(255) DEFAULT NULL,
  `customer_id` varchar(255) DEFAULT NULL,
  `store_id` varchar(255) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `addon_data` varchar(255) DEFAULT NULL,
  `addon_price` float DEFAULT NULL,
  `sub_total` float DEFAULT NULL,
  `tax` float DEFAULT NULL,
  `coupon_id` varchar(255) DEFAULT NULL,
  `coupon_discount` float DEFAULT NULL,
  `extra_discount` float DEFAULT NULL,
  `gross_total` float DEFAULT NULL,
  `paid_amount` float DEFAULT NULL,
  `balance_amount` float DEFAULT NULL,
  `payment_data` varchar(255) DEFAULT NULL,
  `tax_amount` float DEFAULT '0',
  `note` varchar(255) DEFAULT NULL,
  `stutus_change_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `master_comission` float DEFAULT '0',
  `commission_status` varchar(45) DEFAULT NULL,
  `reference_number` varchar(191) DEFAULT NULL,
  `transferred_from_store_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_order: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_orderstatus
CREATE TABLE IF NOT EXISTS `tbl_orderstatus` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_orderstatus: ~7 rows (approximately)
INSERT INTO `tbl_orderstatus` (`id`, `status`) VALUES
	(1, 'Pending'),
	(2, 'Processing'),
	(3, 'Ready To deliver'),
	(4, 'Deliver'),
	(5, 'Returned'),
	(6, 'Cancelled'),
	(7, 'Transfer to other Store');

-- Dumping structure for table icleaners.tbl_order_payment
CREATE TABLE IF NOT EXISTS `tbl_order_payment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_amount` float NOT NULL,
  `payment_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_account` varchar(255) NOT NULL,
  `order_id` varchar(45) DEFAULT NULL,
  `reference_number` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_order_payment: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_roll
CREATE TABLE IF NOT EXISTS `tbl_roll` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll` varchar(255) NOT NULL,
  `rollType` varchar(45) DEFAULT NULL,
  `orders` varchar(45) NOT NULL DEFAULT ' ',
  `expense` varchar(45) NOT NULL DEFAULT ' ',
  `service` varchar(45) NOT NULL DEFAULT ' ',
  `reports` varchar(45) NOT NULL DEFAULT ' ',
  `tools` varchar(45) NOT NULL DEFAULT ' ',
  `mail` varchar(45) NOT NULL DEFAULT ' ',
  `master` varchar(45) NOT NULL DEFAULT ' ',
  `sms` varchar(45) NOT NULL DEFAULT ' ',
  `staff` varchar(45) NOT NULL DEFAULT ' ',
  `pos` varchar(45) NOT NULL DEFAULT ' ',
  `customers` varchar(45) DEFAULT ' ',
  `master_setting` varchar(45) DEFAULT ' ',
  `branch_n_store` varchar(45) DEFAULT ' ',
  `Pay_Out` varchar(45) DEFAULT ' ',
  `account` varchar(45) DEFAULT ' ',
  `coupon` varchar(45) DEFAULT ' ',
  `rollaccess` varchar(45) NOT NULL DEFAULT ' ',
  `roll_status` varchar(45) DEFAULT ' ',
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_roll: ~4 rows (approximately)
INSERT INTO `tbl_roll` (`id`, `roll`, `rollType`, `orders`, `expense`, `service`, `reports`, `tools`, `mail`, `master`, `sms`, `staff`, `pos`, `customers`, `master_setting`, `branch_n_store`, `Pay_Out`, `account`, `coupon`, `rollaccess`, `roll_status`, `delet_flage`) VALUES
	(1, 'Master', 'master', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read', 'read', '', '', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write', 'read,write,edit,delete', 'read,edit', 'read,write,edit', 'read', '', 'read,write,edit,delete', 'read,edit', 'active', '0'),
	(2, 'Store', 'store', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read', 'read', 'read,edit', 'read,edit', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit', 'read,write,edit,delete', '', '', '', 'read,write,edit,delete', 'read,write,edit,delete', 'read,edit', 'active', '0'),
	(3, 'Customer', 'customer', 'read', '', '', '', '', '', '', '', '', 'read,write', '', '', '', '', '', '', '', 'active', '0'),
	(4, 'Order Delete', 'store', 'read,delete', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'active', '0');

-- Dumping structure for table icleaners.tbl_services
CREATE TABLE IF NOT EXISTS `tbl_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `image` varchar(255) NOT NULL,
  `services_type_id` varchar(500) NOT NULL,
  `services_type_price` varchar(500) NOT NULL,
  `store_ID` varchar(45) NOT NULL DEFAULT '1',
  `status` varchar(45) NOT NULL DEFAULT '0',
  `no_of_items` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_services: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_services_type
CREATE TABLE IF NOT EXISTS `tbl_services_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `services_type` varchar(45) NOT NULL,
  `status` varchar(45) NOT NULL,
  `store_ID` varchar(45) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_services_type: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_staff_roll
CREATE TABLE IF NOT EXISTS `tbl_staff_roll` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pos` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `orders` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `customers` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `coupon` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `expense` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `service` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `branch_n_store` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `staff` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sms` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `rollaccess` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `master_setting` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reports` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tools` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mail` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `master` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `Pay_Out` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `main_roll_id` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `staff_id` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_staff` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table icleaners.tbl_staff_roll: ~1 rows (approximately)
INSERT INTO `tbl_staff_roll` (`id`, `pos`, `orders`, `customers`, `coupon`, `expense`, `service`, `branch_n_store`, `staff`, `sms`, `rollaccess`, `master_setting`, `reports`, `tools`, `mail`, `master`, `Pay_Out`, `account`, `main_roll_id`, `staff_id`, `is_staff`) VALUES
	(1, 'read,write', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit', 'read,write,edit,delete', 'read,write,edit,delete', 'read,edit', 'read,edit', 'read', 'read', 'read,edit', 'read,edit', 'read', 'read,write,edit,delete', '1', '1', '0');

-- Dumping structure for table icleaners.tbl_store
CREATE TABLE IF NOT EXISTS `tbl_store` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `logo` varchar(255) NOT NULL,
  `mobile_number` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `shop_commission` float NOT NULL,
  `tax_percent` float NOT NULL,
  `country` varchar(45) NOT NULL,
  `state` varchar(45) NOT NULL,
  `city` varchar(45) NOT NULL,
  `district` varchar(45) NOT NULL,
  `zipcode` varchar(45) NOT NULL,
  `store_email` varchar(255) NOT NULL,
  `store_tax_number` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT '0',
  `delete_flage` varchar(45) NOT NULL DEFAULT '0',
  `createdat` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `roll_ID` varchar(45) DEFAULT '0',
  `admin_id` varchar(45) DEFAULT '0',
  `ready_lead_days` int DEFAULT '2',
  `ready_cutoff_time` varchar(10) DEFAULT '13:00',
  `ready_time` varchar(10) DEFAULT '16:00',
  `ready_working_days` varchar(50) DEFAULT '1,2,3,4,5,6',
  `printing_server_url` varchar(255) DEFAULT 'http://127.0.0.1:4321',
  `silent_print_enabled` int DEFAULT '1',
  `invoice_printer_format` int DEFAULT '1',
  `invoice_printer_name` varchar(255) DEFAULT '',
  `tag_printer_format` int DEFAULT '1',
  `tag_printer_name` varchar(255) DEFAULT '',
  `printer_auto_cut` int DEFAULT '1',
  `printer_open_cash_drawer` int DEFAULT '0',
  `printer_copies` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_store: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_transections
CREATE TABLE IF NOT EXISTS `tbl_transections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` varchar(45) NOT NULL,
  `store_ID` varchar(45) NOT NULL,
  `transec_detail` varchar(255) NOT NULL,
  `transec_type` varchar(255) NOT NULL,
  `customer_id` longtext,
  `debit_amount` float NOT NULL DEFAULT '0',
  `credit_amount` float NOT NULL DEFAULT '0',
  `balance_amount` float DEFAULT '0',
  `date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb3;

-- Dumping data for table icleaners.tbl_transections: ~0 rows (approximately)

-- Dumping structure for table icleaners.tbl_validate
CREATE TABLE IF NOT EXISTS `tbl_validate` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hashs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hashs1` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table icleaners.tbl_validate: ~1 rows (approximately)
INSERT INTO `tbl_validate` (`id`, `data`, `hashs`, `hashs1`) VALUES
	(1, '<script src="/vendor/global/global.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>\n<script src="/Changes/jquery-ui.min.js"></script>', '1908838815d572dea4e8e416fa0f9110f45f107a6f0947d6c86c150d0b639ad9', '1d19c0d86e8c11797d717ffa771f6df51ca40899a25a8023eba0acd28cb18cfa');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

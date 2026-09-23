-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: localhost    Database: icleaners
-- ------------------------------------------------------
-- Server version	8.0.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `tbl_account`
--

DROP TABLE IF EXISTS `tbl_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_account` (
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_account`
--

LOCK TABLES `tbl_account` WRITE;
/*!40000 ALTER TABLE `tbl_account` DISABLE KEYS */;
INSERT INTO `tbl_account` VALUES (7,'Cash Counter / Drawer','CASH-001','Front counter cash register','4',0,'Main Branch','0'),(8,'Main Operating Account','BANK-001','Commercial checking account','4',0,'Main Branch','0'),(10,'Company Master Account','MST-001','Master operational account','',0,'master','0');
/*!40000 ALTER TABLE `tbl_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_addons`
--

DROP TABLE IF EXISTS `tbl_addons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_addons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `addon` varchar(45) NOT NULL,
  `price` float NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_addons`
--

LOCK TABLES `tbl_addons` WRITE;
/*!40000 ALTER TABLE `tbl_addons` DISABLE KEYS */;
INSERT INTO `tbl_addons` VALUES (13,'Stain Removal Treatment',3.5,'0','4'),(14,'Antiseptic Fabric Conditioner',2,'0','4'),(15,'Express Same-Day Rush',5,'0','4');
/*!40000 ALTER TABLE `tbl_addons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_admin`
--

DROP TABLE IF EXISTS `tbl_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_admin` (
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_admin`
--

LOCK TABLES `tbl_admin` WRITE;
/*!40000 ALTER TABLE `tbl_admin` DISABLE KEYS */;
INSERT INTO `tbl_admin` VALUES (1,'Admin','+1-800-555-0100','admin@laundry.com','admin','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby','','1','1','0',NULL,'0',NULL,NULL),(2,'Manager','+1-310-555-0167','manager@laundry.com','manager','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby','4','2','1','0',NULL,'0',NULL,NULL),(3,'Order Delete','+1-310-555-0168','orderdelete@laundry.com','orderdelete','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby','4','3','1','0',NULL,'1',NULL,NULL),(4,'Cashier','+1-310-555-0169','cashier@laundry.com','cashier','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby','4','4','1','0',NULL,'1',NULL,NULL);
/*!40000 ALTER TABLE `tbl_admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_cart`
--

DROP TABLE IF EXISTS `tbl_cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_cart` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_cart`
--

LOCK TABLES `tbl_cart` WRITE;
/*!40000 ALTER TABLE `tbl_cart` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_cart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_cart_servicelist`
--

DROP TABLE IF EXISTS `tbl_cart_servicelist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_cart_servicelist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_id` varchar(255) NOT NULL,
  `service_type_id` varchar(255) NOT NULL,
  `service_type_price` float NOT NULL,
  `service_quntity` int NOT NULL,
  `service_color` varchar(255) NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `service_type_name` varchar(255) NOT NULL,
  `service_img` varchar(255) NOT NULL DEFAULT ' ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_cart_servicelist`
--

LOCK TABLES `tbl_cart_servicelist` WRITE;
/*!40000 ALTER TABLE `tbl_cart_servicelist` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_cart_servicelist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_commision`
--

DROP TABLE IF EXISTS `tbl_commision`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_commision` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_commision`
--

LOCK TABLES `tbl_commision` WRITE;
/*!40000 ALTER TABLE `tbl_commision` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_commision` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_coupon`
--

DROP TABLE IF EXISTS `tbl_coupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_coupon` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_coupon`
--

LOCK TABLES `tbl_coupon` WRITE;
/*!40000 ALTER TABLE `tbl_coupon` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_coupon` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_customer`
--

DROP TABLE IF EXISTS `tbl_customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_customer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `number` varchar(45) DEFAULT NULL,
  `email` varchar(45) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `taxnumber` varchar(45) DEFAULT NULL,
  `username` varchar(45) DEFAULT NULL,
  `password` longtext,
  `store_ID` varchar(45) NOT NULL DEFAULT ' ',
  `main_roll_id` varchar(45) DEFAULT NULL,
  `reffstore` varchar(45) NOT NULL DEFAULT '',
  `approved` int NOT NULL DEFAULT '0',
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_customer`
--

LOCK TABLES `tbl_customer` WRITE;
/*!40000 ALTER TABLE `tbl_customer` DISABLE KEYS */;
INSERT INTO `tbl_customer` VALUES (1,'Customer','+1-310-555-0199','customer@laundry.com','123 Laundry Lane, Los Angeles, CA','TAX-CUST-001','customer','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby','4','14','4',1,'0',NULL,NULL);
/*!40000 ALTER TABLE `tbl_customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_email`
--

DROP TABLE IF EXISTS `tbl_email`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_email` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_email`
--

LOCK TABLES `tbl_email` WRITE;
/*!40000 ALTER TABLE `tbl_email` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_email` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_exp_cat`
--

DROP TABLE IF EXISTS `tbl_exp_cat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_exp_cat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exp_cat_type_id` varchar(45) NOT NULL,
  `cat_name` varchar(255) NOT NULL,
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_exp_cat`
--

LOCK TABLES `tbl_exp_cat` WRITE;
/*!40000 ALTER TABLE `tbl_exp_cat` DISABLE KEYS */;
INSERT INTO `tbl_exp_cat` VALUES (10,'4','Laundry Detergents & Chemicals','0','4'),(11,'4','Utility & Electric Bills','0','4'),(12,'4','Packaging Material & Hangers','0','4');
/*!40000 ALTER TABLE `tbl_exp_cat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_exp_cat_type`
--

DROP TABLE IF EXISTS `tbl_exp_cat_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_exp_cat_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(255) NOT NULL,
  `delet_flage` varchar(45) NOT NULL DEFAULT '0',
  `store_ID` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_exp_cat_type`
--

LOCK TABLES `tbl_exp_cat_type` WRITE;
/*!40000 ALTER TABLE `tbl_exp_cat_type` DISABLE KEYS */;
INSERT INTO `tbl_exp_cat_type` VALUES (4,'Store Operations','0','4');
/*!40000 ALTER TABLE `tbl_exp_cat_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_expense`
--

DROP TABLE IF EXISTS `tbl_expense`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_expense` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_expense`
--

LOCK TABLES `tbl_expense` WRITE;
/*!40000 ALTER TABLE `tbl_expense` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_expense` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_master_shop`
--

DROP TABLE IF EXISTS `tbl_master_shop`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_master_shop` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_master_shop`
--

LOCK TABLES `tbl_master_shop` WRITE;
/*!40000 ALTER TABLE `tbl_master_shop` DISABLE KEYS */;
INSERT INTO `tbl_master_shop` VALUES (1,'1','1','$',0,'1',1,1,'Asia/Karachi',1,12,'1789544344016-1000066546 (1).png','1789544584897-1000066546 (1)jh.png','iCleaners','','','','','','','Copyright 2026 © iCleaners',1,'Microsoft Print to PDF',1,'Microsoft Print to PDF','http://127.0.0.1:4321',1,1,0,1);
/*!40000 ALTER TABLE `tbl_master_shop` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_notification`
--

DROP TABLE IF EXISTS `tbl_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_notification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice` varchar(45) NOT NULL,
  `date` varchar(45) NOT NULL,
  `sender` varchar(45) NOT NULL,
  `received` varchar(45) NOT NULL,
  `notification` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_notification`
--

LOCK TABLES `tbl_notification` WRITE;
/*!40000 ALTER TABLE `tbl_notification` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_order`
--

DROP TABLE IF EXISTS `tbl_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_order` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_order`
--

LOCK TABLES `tbl_order` WRITE;
/*!40000 ALTER TABLE `tbl_order` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_order_payment`
--

DROP TABLE IF EXISTS `tbl_order_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_order_payment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_amount` float NOT NULL,
  `payment_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_account` varchar(255) NOT NULL,
  `order_id` varchar(45) DEFAULT NULL,
  `reference_number` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_order_payment`
--

LOCK TABLES `tbl_order_payment` WRITE;
/*!40000 ALTER TABLE `tbl_order_payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_order_payment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_orderstatus`
--

DROP TABLE IF EXISTS `tbl_orderstatus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_orderstatus` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_orderstatus`
--

LOCK TABLES `tbl_orderstatus` WRITE;
/*!40000 ALTER TABLE `tbl_orderstatus` DISABLE KEYS */;
INSERT INTO `tbl_orderstatus` VALUES (1,'Pending'),(2,'Processing'),(3,'Ready To deliver'),(4,'Deliver'),(5,'Returned'),(6,'Cancelled'),(7,'Transfer to other Store');
/*!40000 ALTER TABLE `tbl_orderstatus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_roll`
--

DROP TABLE IF EXISTS `tbl_roll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_roll` (
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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_roll`
--

LOCK TABLES `tbl_roll` WRITE;
/*!40000 ALTER TABLE `tbl_roll` DISABLE KEYS */;
INSERT INTO `tbl_roll` VALUES (12,'Master','master','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read','read','','','read,write,edit,delete','read,write,edit,delete','read,write','read,write,edit,delete','read,edit','read,write,edit','read','','read,write,edit,delete','read,edit','active','0'),(13,'Store','store','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read','read','read,edit','read,edit','read,write,edit,delete','read,write,edit,delete','read,write,edit','read,write,edit,delete','','','','read,write,edit,delete','read,write,edit,delete','read,edit','active','0'),(14,'Customer','customer','read','','','','','','','','','read,write','read,edit','','','','','','','active','0'),(15,'Order Delete','store','read,delete','','','','','','','','','','','','','','','','','active','0'),(16,'Cashier','store','read,edit','','read','read','','','','','','read,write','read,write,edit','','','','','read','','active','0');
/*!40000 ALTER TABLE `tbl_roll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_services`
--

DROP TABLE IF EXISTS `tbl_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `image` varchar(255) NOT NULL,
  `services_type_id` varchar(500) NOT NULL,
  `services_type_price` varchar(500) NOT NULL,
  `store_ID` varchar(45) NOT NULL DEFAULT '1',
  `status` varchar(45) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_services`
--

LOCK TABLES `tbl_services` WRITE;
/*!40000 ALTER TABLE `tbl_services` DISABLE KEYS */;
INSERT INTO `tbl_services` VALUES (121,'Men\'s Formal Shirt','men_s_formal_shirt.png','55,56,57,58,60,61,62,63','5.00,12.00,3.50,7.00,4.50,4.00,9.00,6.00','4','0'),(122,'Men\'s Casual T-Shirt','men_s_casual_t_shirt.png','55,57,58,62,63,64','4.00,3.00,5.50,8.00,5.00,6.00','4','0'),(123,'Trousers & Chinos','trousers_chinos.png','55,56,57,58,60,62,72','6.00,14.00,4.00,8.50,5.00,11.00,9.00','4','0'),(124,'Casual Denim Jeans','casual_denim_jeans.png','55,56,57,58,60,63,71,72','6.50,15.00,4.50,9.00,5.50,7.50,22.00,10.00','4','0'),(125,'Two-Piece Business Suit','two_piece_business_suit.png','56,57,60,62,63,64,72','28.00,10.00,8.00,20.00,14.00,32.00,18.00','4','0'),(126,'Three-Piece Tuxedo','three_piece_tuxedo.png','56,57,60,62,64,72','38.00,14.00,10.00,25.00,42.00,22.00','4','0'),(127,'Casual Blazer / Sport Coat','casual_blazer_sport_coat.png','56,57,60,62,64','20.00,8.00,6.50,15.00,24.00','4','0'),(128,'Necktie / Bowtie / Scarf','necktie_bowtie_scarf.png','56,57,59,60','8.00,4.00,7.00,5.00','4','0'),(129,'Silk Blouse / Top','silk_blouse_top.png','56,57,59,60,62,67','18.00,7.00,14.00,6.00,16.00,22.00','4','0'),(130,'Pleated Skirt','pleated_skirt.png','55,56,57,58,60,72','7.00,15.00,6.50,9.50,5.00,8.00','4','0'),(131,'Casual Summer Dress','casual_summer_dress.png','55,56,57,58,60,62','9.00,18.00,6.00,12.00,6.50,14.00','4','0'),(132,'Evening Cocktail Gown','evening_cocktail_gown.png','56,57,59,60,62,64,67,72','35.00,12.00,28.00,12.00,25.00,40.00,38.00,20.00','4','0'),(133,'Traditional Silk Saree','traditional_silk_saree.png','56,57,59,60,61,67','22.00,8.00,18.00,7.50,9.00,26.00','4','0'),(134,'Embroidered Kurta / Salwar Kameez','embroidered_kurta_salwar_kameez.png','55,56,57,58,59,60,63','8.00,16.00,5.50,11.00,12.00,6.00,9.50','4','0'),(135,'Formal Women\'s Jumpsuit','formal_women_s_jumpsuit.png','56,57,58,60,62','22.00,8.00,14.00,6.00,15.00','4','0'),(136,'Cashmere Cardigan','cashmere_cardigan.png','56,57,59,60,65','20.00,7.00,16.00,6.00,24.00','4','0'),(137,'Winter Woolen Jacket','winter_woolen_jacket.png','56,57,60,63,65','28.00,10.00,8.00,12.00,32.00','4','0'),(138,'Down Feather Puffer Coat','down_feather_puffer_coat.png','55,56,60,63,64','22.00,34.00,9.00,14.00,38.00','4','0'),(139,'Heavy Trench Coat','heavy_trench_coat.png','56,57,60,62,63,64','32.00,11.00,8.50,22.00,15.00,36.00','4','0'),(140,'Genuine Leather Biker Jacket','genuine_leather_biker_jacket.png','56,60,63,66,71','45.00,15.00,18.00,55.00,40.00','4','0'),(141,'Suede Coat / Overshirt','suede_coat_overshirt.png','56,60,66,71','42.00,14.00,52.00,38.00','4','0');
/*!40000 ALTER TABLE `tbl_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_services_type`
--

DROP TABLE IF EXISTS `tbl_services_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_services_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `services_type` varchar(45) NOT NULL,
  `status` varchar(45) NOT NULL,
  `store_ID` varchar(45) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_services_type`
--

LOCK TABLES `tbl_services_type` WRITE;
/*!40000 ALTER TABLE `tbl_services_type` DISABLE KEYS */;
INSERT INTO `tbl_services_type` VALUES (55,'Wash & Fold','0','4'),(56,'Dry Cleaning','0','4'),(57,'Steam Press','0','4'),(58,'Wash & Iron','0','4'),(59,'Delicate Hand Wash','0','4'),(60,'Stain Treatment & Spotting','0','4'),(61,'Starching & Polishing','0','4'),(62,'Express 4-Hour Rush','0','4'),(63,'Anti-Bacterial Sanitization','0','4'),(64,'Eco-Friendly Green Clean','0','4'),(65,'Woolen & Cashmere Care','0','4'),(66,'Leather & Suede Restoration','0','4'),(67,'Silk & Velvet Specialty','0','4'),(68,'Bedding & Linen Refresh','0','4'),(69,'Curtain & Drapery Treatment','0','4');
/*!40000 ALTER TABLE `tbl_services_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_staff_roll`
--

DROP TABLE IF EXISTS `tbl_staff_roll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_staff_roll` (
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_staff_roll`
--

LOCK TABLES `tbl_staff_roll` WRITE;
/*!40000 ALTER TABLE `tbl_staff_roll` DISABLE KEYS */;
INSERT INTO `tbl_staff_roll` VALUES (1,'read,write','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit','read,write,edit,delete','read,write,edit,delete','read,edit','read,edit','read','read','read,edit','read,edit','read','read,write,edit,delete','12','1','0'),(2,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','2','0'),(3,'read,write','read,delete','read','','','','','','','','','read','','','','','','15','3','1'),(4,'read,write','read,edit','read,write,edit','read','','read','','','','','','read','','','','','','16','4','1');
/*!40000 ALTER TABLE `tbl_staff_roll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_store`
--

DROP TABLE IF EXISTS `tbl_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_store` (
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_store`
--

LOCK TABLES `tbl_store` WRITE;
/*!40000 ALTER TABLE `tbl_store` DISABLE KEYS */;
INSERT INTO `tbl_store` VALUES (4,'Main Store','default.png','+1-555-0199','manager','$2b$10$hDuu1RmCgeCC5HQdI1j1o.i8IHN9D6WGKz1hQNmjjfvoWHf/0ZEby',15,9.5,'USA','CA','Los Angeles','Los Angeles','90001','store1@laundry.com','TAX-90210-4','100 Main Street, Suite 1','1','0','2026-09-18 11:35:11','13','2');
/*!40000 ALTER TABLE `tbl_store` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_transections`
--

DROP TABLE IF EXISTS `tbl_transections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_transections` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_transections`
--

LOCK TABLES `tbl_transections` WRITE;
/*!40000 ALTER TABLE `tbl_transections` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_transections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_validate`
--

DROP TABLE IF EXISTS `tbl_validate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_validate` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hashs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hashs1` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_validate`
--

LOCK TABLES `tbl_validate` WRITE;
/*!40000 ALTER TABLE `tbl_validate` DISABLE KEYS */;
INSERT INTO `tbl_validate` VALUES (1,'<script src=\"/vendor/global/global.min.js\"></script>\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js\"></script>\n<script src=\"/Changes/jquery-ui.min.js\"></script>','1908838815d572dea4e8e416fa0f9110f45f107a6f0947d6c86c150d0b639ad9','1d19c0d86e8c11797d717ffa771f6df51ca40899a25a8023eba0acd28cb18cfa');
/*!40000 ALTER TABLE `tbl_validate` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-24  0:04:31

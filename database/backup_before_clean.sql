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
INSERT INTO `tbl_account` VALUES (7,'Cash Counter / Drawer','CASH-4','Front counter cash register','4',500,'Royal Care Garment Studio','0'),(8,'Main Operating Account','BANK-US-1004','Commercial checking account','4',3500,'Royal Care Garment Studio','0'),(10,'Jazz Cash','946512315','','',50000,'master','0'),(13,'Jazz cash','654612311','','9',499675,'Store 3','0'),(14,'easiy paisa','657651631','','9',58961300,'Store 3','0'),(15,'askari bank','85798435454','','7',8949000,'Store 2','0');
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
INSERT INTO `tbl_addons` VALUES (13,'Stain Removal Treatment',3.5,'0','4'),(14,'Antiseptic Fabric Conditioner',2,'0','4'),(15,'Express Same-Day Rush',5,'0','4'),(16,'Eco Moth-Proof Storage Bag',2.5,'0','7'),(17,'st3 addon 1',10,'0','9');
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
INSERT INTO `tbl_admin` VALUES (1,'Super Admin','+1-800-555-0100','admin@laundry.com','admin','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','','1','1','0',NULL,'0',NULL,NULL),(11,'Store 1','+1-310-555-0167','care@royallaundry.com','store1','$2b$10$Cz9.b2lOZEurIQ1lx81iI.RdaUZ.tG7ncsazBj22kts3a5LuD1jzW','4','11','1','0',NULL,'0',NULL,NULL),(12,'Michael Ross','+1-555-0131','staff1.royalcare@laundry.com','staff_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','12','1','0',NULL,'1',NULL,NULL),(13,'Olivia Vance (Order Delete)','+1-555-0132','lead.royalcare@laundry.com','lead_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','13','1','0',NULL,'1',NULL,NULL),(16,'Store 2','923225126622','store2@gmail.com','store2','$2b$10$AysaI88sodneA5tE5EOM/eWNbUiJOQ5/WPyu96FWsDQv5Z4Jj7PmO','7','16','1','0','1790145635533-Gemini_Generated_Image_jq9fzqjq9fzqjq9f-removebg-preview.png','0',NULL,NULL),(18,'Store 3','923525432154','store3@gmail.com','store3','$2b$10$8QExTR180LshgA9.ZeKFYeigFo7frcmUqGLYEiL8GIQ4ElB6ciypa','9','18','1','0','1790149463265-1000066546 (1).png','0',NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_cart`
--

LOCK TABLES `tbl_cart` WRITE;
/*!40000 ALTER TABLE `tbl_cart` DISABLE KEYS */;
INSERT INTO `tbl_cart` VALUES (1,'1,1','0','43','2026-09-23 06:55:28','0,195','#ORD0099','0',0,'2026-09-23 06:55:28',0,'0',0,0,6.5,7.12,0,'0',7.12,'',0.62),(3,'1,18','9','57','2026-09-23 10:19:01','0','#ORD0099','0',0,'2026-09-23 10:19:01',0,'0',0,5,0,0,0,'0',0,'',0),(4,'1,16','0','0','2026-09-23 07:59:31','0','#ORD0001','0',0,'2026-09-23 07:59:31',0,'0',0,0,0,0,0,'0',0,' ',0),(5,'1,11','4','40','2026-09-23 09:59:23','0','#ORD0098','0',0,'2026-09-23 09:59:23',0,'0',0,9.5,0,0,0,'0',0,' ',0),(6,'1,12','4','40','2026-09-23 10:03:27','0','#ORD0098','0',0,'2026-09-23 10:03:27',0,'0',0,9.5,0,0,0,'0',0,' ',0);
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
) ENGINE=InnoDB AUTO_INCREMENT=196 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_cart_servicelist`
--

LOCK TABLES `tbl_cart_servicelist` WRITE;
/*!40000 ALTER TABLE `tbl_cart_servicelist` DISABLE KEYS */;
INSERT INTO `tbl_cart_servicelist` VALUES (145,'121','55',5,1,'#333333','Men\'s Formal Shirt','Wash & Fold','men_s_formal_shirt.png'),(146,'122','55',4,1,'#333333','Men\'s Casual T-Shirt','Wash & Fold','men_s_casual_t_shirt.png'),(147,'123','56',14,2,'#333333','Trousers & Chinos','Dry Cleaning','trousers_chinos.png'),(148,'123','55',6,1,'#333333','Trousers & Chinos','Wash & Fold','trousers_chinos.png'),(149,'124','56',15,2,'#333333','Casual Denim Jeans','Dry Cleaning','casual_denim_jeans.png'),(150,'125','60',8,1,'#333333','Two-Piece Business Suit','Stain Treatment & Spotting','two_piece_business_suit.png'),(151,'124','55',6.5,1,'#333333','Casual Denim Jeans','Wash & Fold','casual_denim_jeans.png'),(152,'125','56',28,1,'#333333','Two-Piece Business Suit','Dry Cleaning','two_piece_business_suit.png'),(153,'126','57',14,2,'#333333','Three-Piece Tuxedo','Steam Press','three_piece_tuxedo.png'),(154,'126','56',38,1,'#333333','Three-Piece Tuxedo','Dry Cleaning','three_piece_tuxedo.png'),(155,'127','57',8,2,'#333333','Casual Blazer / Sport Coat','Steam Press','casual_blazer_sport_coat.png'),(156,'128','59',7,1,'#333333','Necktie / Bowtie / Scarf','Delicate Hand Wash','necktie_bowtie_scarf.png'),(157,'127','56',20,1,'#333333','Casual Blazer / Sport Coat','Dry Cleaning','casual_blazer_sport_coat.png'),(158,'128','56',8,1,'#333333','Necktie / Bowtie / Scarf','Dry Cleaning','necktie_bowtie_scarf.png'),(159,'129','57',7,2,'#333333','Silk Blouse / Top','Steam Press','silk_blouse_top.png'),(160,'129','56',18,1,'#333333','Silk Blouse / Top','Dry Cleaning','silk_blouse_top.png'),(161,'130','56',15,2,'#333333','Pleated Skirt','Dry Cleaning','pleated_skirt.png'),(162,'131','57',6,1,'#333333','Casual Summer Dress','Steam Press','casual_summer_dress.png'),(163,'130','55',7,1,'#333333','Pleated Skirt','Wash & Fold','pleated_skirt.png'),(164,'131','55',9,1,'#333333','Casual Summer Dress','Wash & Fold','casual_summer_dress.png'),(165,'132','57',12,2,'#333333','Evening Cocktail Gown','Steam Press','evening_cocktail_gown.png'),(166,'132','56',35,1,'#333333','Evening Cocktail Gown','Dry Cleaning','evening_cocktail_gown.png'),(167,'133','57',8,2,'#333333','Traditional Silk Saree','Steam Press','traditional_silk_saree.png'),(168,'134','57',5.5,1,'#333333','Embroidered Kurta / Salwar Kameez','Steam Press','embroidered_kurta_salwar_kameez.png'),(169,'133','56',22,1,'#333333','Traditional Silk Saree','Dry Cleaning','traditional_silk_saree.png'),(170,'134','55',8,1,'#333333','Embroidered Kurta / Salwar Kameez','Wash & Fold','embroidered_kurta_salwar_kameez.png'),(171,'135','57',8,2,'#333333','Formal Women\'s Jumpsuit','Steam Press','formal_women_s_jumpsuit.png'),(172,'135','56',22,1,'#333333','Formal Women\'s Jumpsuit','Dry Cleaning','formal_women_s_jumpsuit.png'),(173,'136','57',7,2,'#333333','Cashmere Cardigan','Steam Press','cashmere_cardigan.png'),(174,'137','60',8,1,'#333333','Winter Woolen Jacket','Stain Treatment & Spotting','winter_woolen_jacket.png'),(175,'136','56',20,1,'#333333','Cashmere Cardigan','Dry Cleaning','cashmere_cardigan.png'),(176,'137','56',28,1,'#333333','Winter Woolen Jacket','Dry Cleaning','winter_woolen_jacket.png'),(177,'138','56',34,2,'#333333','Down Feather Puffer Coat','Dry Cleaning','down_feather_puffer_coat.png'),(178,'138','55',22,1,'#333333','Down Feather Puffer Coat','Wash & Fold','down_feather_puffer_coat.png'),(179,'139','57',11,2,'#333333','Heavy Trench Coat','Steam Press','heavy_trench_coat.png'),(180,'140','63',18,1,'#333333','Genuine Leather Biker Jacket','Anti-Bacterial Sanitization','genuine_leather_biker_jacket.png'),(181,'139','56',32,1,'#333333','Heavy Trench Coat','Dry Cleaning','heavy_trench_coat.png'),(182,'140','56',45,1,'#333333','Genuine Leather Biker Jacket','Dry Cleaning','genuine_leather_biker_jacket.png'),(183,'141','60',14,2,'#333333','Suede Coat / Overshirt','Stain Treatment & Spotting','suede_coat_overshirt.png'),(184,'141','56',42,1,'#333333','Suede Coat / Overshirt','Dry Cleaning','suede_coat_overshirt.png'),(185,'142','57',4,2,'#333333','Hoodie & Sweatshirt','Steam Press','hoodie_sweatshirt.png'),(186,'143','58',7.5,1,'#333333','Tracksuit / Sweatpants','Wash & Iron','tracksuit_sweatpants.png'),(187,'142','55',6.5,1,'#333333','Hoodie & Sweatshirt','Wash & Fold','hoodie_sweatshirt.png'),(188,'143','55',6,1,'#333333','Tracksuit / Sweatpants','Wash & Fold','tracksuit_sweatpants.png'),(189,'144','56',18,2,'#333333','Bed Sheet & Pillowcase Set','Dry Cleaning','bed_sheet_pillowcase_set.png'),(190,'144','55',8,1,'#333333','Bed Sheet & Pillowcase Set','Wash & Fold','bed_sheet_pillowcase_set.png'),(191,'145','56',38,2,'#333333','Heavy Quilt & Comforter','Dry Cleaning','heavy_quilt_comforter.png'),(192,'146','57',7.5,1,'#333333','Duvet Cover (King/Queen)','Steam Press','duvet_cover_king_queen.png'),(193,'171','73',100,1,'#000000','store 3 service 3','store 3 service type 1','1790152262660-output-onlinepngtools.png'),(194,'171','73',100,1,'#000000','store 3 service 3','store 3 service type 1','1790152262660-output-onlinepngtools.png'),(195,'131','60',6.5,1,'#000000','Casual Summer Dress','Stain Treatment & Spotting','casual_summer_dress.png');
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_coupon`
--

LOCK TABLES `tbl_coupon` WRITE;
/*!40000 ALTER TABLE `tbl_coupon` DISABLE KEYS */;
INSERT INTO `tbl_coupon` VALUES (10,'Welcome 10% Off','WELCOME10-ROYALCARE',20,10,'2026-01-01 00:00:00','2026-12-31 00:00:00','4','percentage',3,'0'),(11,'Flat $5 Off Orders Over $35','SAVE5-ROYALCARE',35,5,'2026-01-01 00:00:00','2026-12-31 00:00:00','4','amount',5,'0'),(12,'VIP Member 15% Off','VIP15-ROYALCARE',50,15,'2026-01-01 00:00:00','2026-12-31 00:00:00','4','percentage',10,'0'),(13,'Earum et voluptatem','XAQL2B',63,17,'1998-09-26 00:00:00','1973-08-22 00:00:00','9','2',45,'0');
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
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_customer`
--

LOCK TABLES `tbl_customer` WRITE;
/*!40000 ALTER TABLE `tbl_customer` DISABLE KEYS */;
INSERT INTO `tbl_customer` VALUES (40,'Walk In Customer','','','',NULL,NULL,NULL,'4','14','4',1,'0',NULL,NULL),(41,'Robert Downey','+1-917-553-0200','robert.d.royalcare@gmail.com','120 West 44th St','SSN-0200','robert.d_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(42,'Emma Watson','+1-917-553-0201','emma.w.royalcare@gmail.com','45 Lexington Ave','SSN-0201','emma.w_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(43,'James Anderson','+1-917-553-0202','james.a.royalcare@gmail.com','882 Park Blvd','SSN-0202','james.a_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(44,'Sophia Martinez','+1-917-553-0203','sophia.m.royalcare@gmail.com','310 Green St','SSN-0203','sophia.m_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(45,'William Turner','+1-917-553-0204','william.t.royalcare@gmail.com','14 Elmwood Terrace','SSN-0204','william.t_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(46,'Ava Robinson','+1-917-553-0205','ava.r.royalcare@gmail.com','72 Franklin Way','SSN-0205','ava.r_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','4','14','4',1,'0',NULL,NULL),(47,'Benjamin Scott','+1-917-553-0206','ben.scott.royalcare@gmail.com','55 Ocean Ave','SSN-0206','ben.scott_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(48,'Charlotte Evans','+1-917-553-0207','charlotte.e.royalcare@gmail.com','19 Maple Grove','SSN-0207','charlotte.e_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(49,'Lucas Wright','+1-917-553-0208','lucas.w.royalcare@gmail.com','404 Industrial Way','SSN-0208','lucas.w_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(50,'Mia Henderson','+1-917-553-0209','mia.h.royalcare@gmail.com','730 Highland Ave','SSN-0209','mia.h_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(51,'Henry Brooks','+1-917-553-0210','henry.b.royalcare@gmail.com','12 Riverbank Dr','SSN-0210','henry.b_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(52,'Grace Mitchell','+1-917-553-0211','grace.m.royalcare@gmail.com','91 Sunset Plaza','SSN-0211','grace.m_royalcare','$2b$10$CuEx0Lvpp2UtoClKGvnMgOG46tHX.oBwwOCGN3ptQ1It7CqjQO1xO','7','14','4',1,'0',NULL,NULL),(55,'Walk in Customer',NULL,NULL,NULL,NULL,NULL,NULL,'7',NULL,'7',1,'0',NULL,NULL),(57,'Walk in Customer',NULL,NULL,NULL,NULL,NULL,NULL,'9',NULL,'9',1,'0',NULL,NULL),(58,'store 3 customer','9165154614','store3cust@gmail.com','none none none','65461685165','store3cust','$2b$10$cgSrBHHFaWkE.vVtAZpoVuKsjmWtqhAWbFgUryANDmcr5ne5hM8A.','9','14','9',1,'0',NULL,NULL),(59,'Brian Hansen','563654321','vasaza@mailinator.com','Voluptatem qui volup','524','lyjov','$2b$10$ydUb.DJroodE.g/JkXyHROyGByrLPIJAIDmiweEH0lbIcMuPOFdX6','9','14','9',1,'0',NULL,NULL),(60,'Hop Bruce','726','dazegetav@mailinator.com','Ex quis corporis vol','707','lorocaloc','$2b$10$V20qb4okicZmrM5zQdESW.51rDKyYjKEviH9zWN4MKgb3zG1oy7Re','9','14','9',1,'0',NULL,NULL),(61,'Alexis Nguyen','220','katub@mailinator.com','Accusantium nihil ad','966','lavovymomu','$2b$10$XADNdCR/87oUNT7FAOXzKOIGrIEP5aUzrocIKbsBkJyBtM16TBxd6','9','14','9',1,'0',NULL,NULL),(62,'Hayfa Flowers','310','kegysomodo@mailinator.com','Voluptas voluptatibu','346','jadywofi','$2b$10$wSDflZzvu1257jIyZv9Lz.EWvTTu5.NK3ixNpZxhNsAjsklIqwEPy','9','14','9',1,'0',NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3;
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
INSERT INTO `tbl_exp_cat` VALUES (10,'4','Laundry Detergents & Chemicals','0','4'),(11,'4','Utility & Electric Bills','0','4'),(12,'4','Packaging Material & Hangers','0','4'),(14,'5','stoer 3 exp 1','0','9'),(17,'5','store 3 exp 2','0','9'),(18,'7','test cat tu[e','0','7');
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
INSERT INTO `tbl_exp_cat_type` VALUES (4,'Store Operations','0','4'),(5,'store 3 expense type 1','0','9'),(6,'store 3 expense type 2','0','9'),(7,'test cat','0','7');
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_expense`
--

LOCK TABLES `tbl_expense` WRITE;
/*!40000 ALTER TABLE `tbl_expense` DISABLE KEYS */;
INSERT INTO `tbl_expense` VALUES (16,'2026-08-25 06:35:11',145,'Eco Detergent bulk container (50L)','10','0','7','11','0','4',0,0),(17,'2026-08-31 06:35:11',320,'Commercial Electricity & Steam Boiler Power','11','0','7','11','0','4',0,0),(18,'2026-09-06 06:35:11',88.5,'Hangers & Eco Garment Covers restock','12','0','7','11','0','4',0,0),(19,'2026-09-12 06:35:11',65,'Water Filtration Cartridge Replacement','10','0','7','11','0','4',0,0),(20,'2026-09-16 06:35:11',110,'Steam Press Maintenance & Descaling','4','0','7','11','0','4',0,0),(22,'2026-09-22 19:00:00',545,'ouypo biuj  kj hiu','14','no','13','18','0','9',0,87),(23,'2026-09-23 19:00:00',5645,'','18','no','15','16','0','7',0,89);
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
INSERT INTO `tbl_master_shop` VALUES (1,'1','1','$',0,'1',1,1,'Asia/Karachi',1,12,'1789544344016-1000066546 (1).png','1789544584897-1000066546 (1)jh.png','iCleaners','','','','','','','Copyright 2026 ┬⌐ iCleaners',1,'Microsoft Print to PDF',1,'Microsoft Print to PDF','http://127.0.0.1:4321',1,1,0,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_notification`
--

LOCK TABLES `tbl_notification` WRITE;
/*!40000 ALTER TABLE `tbl_notification` DISABLE KEYS */;
INSERT INTO `tbl_notification` VALUES (1,'#ORD0121','2026-09-15','2','1','New order #ORD0121 registered at Metro Dry Cleaners & Laundry'),(2,'#ORD0122','2026-09-16','2','1','New order #ORD0122 registered at Metro Dry Cleaners & Laundry'),(3,'#ORD0123','2026-09-17','2','1','New order #ORD0123 registered at Metro Dry Cleaners & Laundry'),(4,'#ORD0124','2026-09-18','2','1','New order #ORD0124 registered at Metro Dry Cleaners & Laundry'),(5,'#ORD0145','2026-09-15','5','1','New order #ORD0145 registered at UrbanDhobi Express'),(6,'#ORD0146','2026-09-16','5','1','New order #ORD0146 registered at UrbanDhobi Express'),(7,'#ORD0147','2026-09-17','5','1','New order #ORD0147 registered at UrbanDhobi Express'),(8,'#ORD0148','2026-09-18','5','1','New order #ORD0148 registered at UrbanDhobi Express'),(9,'#ORD0169','2026-09-15','8','1','New order #ORD0169 registered at Sunrise Eco Washers'),(10,'#ORD0170','2026-09-16','8','1','New order #ORD0170 registered at Sunrise Eco Washers'),(11,'#ORD0171','2026-09-17','8','1','New order #ORD0171 registered at Sunrise Eco Washers'),(12,'#ORD0172','2026-09-18','8','1','New order #ORD0172 registered at Sunrise Eco Washers'),(13,'#ORD0193','2026-09-15','11','1','New order #ORD0193 registered at Royal Care Garment Studio'),(14,'#ORD0194','2026-09-16','11','1','New order #ORD0194 registered at Royal Care Garment Studio'),(15,'#ORD0195','2026-09-17','11','1','New order #ORD0195 registered at Royal Care Garment Studio'),(16,'#ORD0196','2026-09-18','11','1','New order #ORD0196 registered at Royal Care Garment Studio'),(17,'#ORD0001','2026-09-23','18','57','There is a new order registered, please check it orderid #ORD0001.'),(18,'#ORD0001','2026-09-23','18','9','There is a new order registered, please check it orderid #ORD0001.'),(19,'#ORD0098','2026-09-23','18','62','There is a new order registered, please check it orderid #ORD0098.'),(20,'#ORD0098','2026-09-23','18','9','There is a new order registered, please check it orderid #ORD0098.');
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
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_order`
--

LOCK TABLES `tbl_order` WRITE;
/*!40000 ALTER TABLE `tbl_order` DISABLE KEYS */;
INSERT INTO `tbl_order` VALUES (97,'#ORD0001','2026-09-22 19:00:00','2026-09-22 19:00:00',1,'0,193','57','9','1,18','17',10,100,5,'0',0,0,115.5,115.5,0,'81',5.5,'','2026-09-23 15:07:50',11.55,'1','',NULL),(98,'#ORD0098','2026-09-22 19:00:00','2026-09-22 19:00:00',1,'0,194','62','9','1,18','0',0,100,5,'0',0,0,105,105,0,'82',5,'','2026-09-23 15:19:01',10.5,'1','',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_order_payment`
--

LOCK TABLES `tbl_order_payment` WRITE;
/*!40000 ALTER TABLE `tbl_order_payment` DISABLE KEYS */;
INSERT INTO `tbl_order_payment` VALUES (81,115.5,'2026-09-22 19:00:00','13','97',''),(82,105,'2026-09-22 19:00:00','13','98','');
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_roll`
--

LOCK TABLES `tbl_roll` WRITE;
/*!40000 ALTER TABLE `tbl_roll` DISABLE KEYS */;
INSERT INTO `tbl_roll` VALUES (12,'Master','master','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read','read','','','read,write,edit,delete','read,write,edit,delete','read,write','read,write,edit,delete','read,edit','read,write,edit','read','','read,write,edit,delete','read,edit','active','0'),(13,'Store','store','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read','read','read,edit','read,edit','read,write,edit,delete','read,write,edit,delete','read,write,edit','read,write,edit,delete','','','','read,write,edit,delete','read,write,edit,delete','read,edit','active','0'),(14,'Customer','customer','read','','','','','','','','','read,write','read,edit','','','','','','','active','0'),(15,'Order Delete','store','read,delete','','','','','','','','','','','','','','','','','active','0');
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
INSERT INTO `tbl_services` VALUES (121,'Men\'s Formal Shirt','men_s_formal_shirt.png','55,56,57,58,60,61,62,63','5.00,12.00,3.50,7.00,4.50,4.00,9.00,6.00','4','0'),(122,'Men\'s Casual T-Shirt','men_s_casual_t_shirt.png','55,57,58,62,63,64','4.00,3.00,5.50,8.00,5.00,6.00','4','0'),(123,'Trousers & Chinos','trousers_chinos.png','55,56,57,58,60,62,72','6.00,14.00,4.00,8.50,5.00,11.00,9.00','4','0'),(124,'Casual Denim Jeans','casual_denim_jeans.png','55,56,57,58,60,63,71,72','6.50,15.00,4.50,9.00,5.50,7.50,22.00,10.00','4','0'),(125,'Two-Piece Business Suit','two_piece_business_suit.png','56,57,60,62,63,64,72','28.00,10.00,8.00,20.00,14.00,32.00,18.00','4','0'),(126,'Three-Piece Tuxedo','three_piece_tuxedo.png','56,57,60,62,64,72','38.00,14.00,10.00,25.00,42.00,22.00','4','0'),(127,'Casual Blazer / Sport Coat','casual_blazer_sport_coat.png','56,57,60,62,64','20.00,8.00,6.50,15.00,24.00','4','0'),(128,'Necktie / Bowtie / Scarf','necktie_bowtie_scarf.png','56,57,59,60','8.00,4.00,7.00,5.00','4','0'),(129,'Silk Blouse / Top','silk_blouse_top.png','56,57,59,60,62,67','18.00,7.00,14.00,6.00,16.00,22.00','4','0'),(130,'Pleated Skirt','pleated_skirt.png','55,56,57,58,60,72','7.00,15.00,6.50,9.50,5.00,8.00','4','0'),(131,'Casual Summer Dress','casual_summer_dress.png','55,56,57,58,60,62','9.00,18.00,6.00,12.00,6.50,14.00','4','0'),(132,'Evening Cocktail Gown','evening_cocktail_gown.png','56,57,59,60,62,64,67,72','35.00,12.00,28.00,12.00,25.00,40.00,38.00,20.00','4','0'),(133,'Traditional Silk Saree','traditional_silk_saree.png','56,57,59,60,61,67','22.00,8.00,18.00,7.50,9.00,26.00','4','0'),(134,'Embroidered Kurta / Salwar Kameez','embroidered_kurta_salwar_kameez.png','55,56,57,58,59,60,63','8.00,16.00,5.50,11.00,12.00,6.00,9.50','4','0'),(135,'Formal Women\'s Jumpsuit','formal_women_s_jumpsuit.png','56,57,58,60,62','22.00,8.00,14.00,6.00,15.00','4','0'),(136,'Cashmere Cardigan','cashmere_cardigan.png','56,57,59,60,65','20.00,7.00,16.00,6.00,24.00','4','0'),(137,'Winter Woolen Jacket','winter_woolen_jacket.png','56,57,60,63,65','28.00,10.00,8.00,12.00,32.00','4','0'),(138,'Down Feather Puffer Coat','down_feather_puffer_coat.png','55,56,60,63,64','22.00,34.00,9.00,14.00,38.00','4','0'),(139,'Heavy Trench Coat','heavy_trench_coat.png','56,57,60,62,63,64','32.00,11.00,8.50,22.00,15.00,36.00','4','0'),(140,'Genuine Leather Biker Jacket','genuine_leather_biker_jacket.png','56,60,63,66,71','45.00,15.00,18.00,55.00,40.00','4','0'),(141,'Suede Coat / Overshirt','suede_coat_overshirt.png','56,60,66,71','42.00,14.00,52.00,38.00','4','0'),(142,'Hoodie & Sweatshirt','hoodie_sweatshirt.png','55,57,58,60,62,63','6.50,4.00,8.00,4.50,10.00,7.00','7','0'),(143,'Tracksuit / Sweatpants','tracksuit_sweatpants.png','55,57,58,62,63','6.00,4.00,7.50,9.00,6.50','7','0'),(144,'Bed Sheet & Pillowcase Set','bed_sheet_pillowcase_set.png','55,56,57,58,62,63,68','8.00,18.00,6.00,11.00,14.00,10.00,16.00','7','0'),(145,'Heavy Quilt & Comforter','heavy_quilt_comforter.png','55,56,60,63,64,68','20.00,38.00,10.00,16.00,42.00,32.00','7','0'),(146,'Duvet Cover (King/Queen)','duvet_cover_king_queen.png','55,56,57,58,63,68','12.00,24.00,7.50,15.00,12.00,22.00','7','0'),(147,'Woolen Fleece Blanket','woolen_fleece_blanket.png','55,56,63,65,68','14.00,26.00,12.00,28.00,24.00','7','0'),(148,'Bath Towel & Bathrobe Set','bath_towel_bathrobe_set.png','55,57,58,62,63,68','7.00,4.50,9.00,12.00,8.50,11.00','7','0'),(149,'Plush Decorative Pillow / Cushion','plush_decorative_pillow_cushion.png','55,56,60,63,68','6.00,12.00,4.00,7.50,10.00','7','0'),(150,'Tablecloth & Napkins (Set of 6)','tablecloth_napkins_set_of_6.png','55,56,57,58,60,61','9.00,18.00,7.00,13.00,6.00,8.00','7','0'),(151,'Blackout Curtains (Per Panel)','blackout_curtains_per_panel.png','56,57,60,63,69','22.00,9.00,7.00,12.00,26.00','7','0'),(152,'Sheer Window Drapes (Pair)','sheer_window_drapes_pair.png','56,57,59,60,69','18.00,7.50,15.00,5.50,22.00','7','0'),(153,'Sofa Slipcover Set','sofa_slipcover_set.png','55,56,60,63,64','24.00,40.00,12.00,16.00,45.00','7','0'),(154,'Area Rug Runner (Washable)','area_rug_runner_washable.png','55,56,60,63','18.00,32.00,9.00,14.00','7','0'),(155,'Athletic & Canvas Sneakers','athletic_canvas_sneakers.png','55,60,62,63,70','12.00,6.00,16.00,10.00,20.00','7','0'),(156,'Leather Oxford Dress Shoes','leather_oxford_dress_shoes.png','60,63,66,70,71','8.00,12.00,28.00,26.00,22.00','7','0'),(157,'Suede Boots / Chukka','suede_boots_chukka.png','60,63,66,70','9.00,12.00,30.00,28.00','7','0'),(158,'Handbag / Purse (Leather/Fabric)','handbag_purse_leather_fabric.png','59,60,63,66,71','18.00,8.00,12.00,35.00,25.00','7','0'),(159,'Backpack & Gym Bag','backpack_gym_bag.png','55,60,62,63,64','10.00,5.00,14.00,9.00,15.00','7','0'),(160,'Motorcycle / Winter Riding Gloves','motorcycle_winter_riding_gloves.png','56,59,60,63,66','12.00,10.00,5.00,8.00,18.00','7','0'),(161,'store 3 service 1','1790151229127-image-removebg-preview.png','73','100','1','0'),(162,'store 3 service 2','1790151303366-Gemini_Generated_Image_jq9fzqjq9fzqjq9f.jpg','73','100','1','0'),(171,'store 3 service 3','1790152262660-output-onlinepngtools.png','73','100','9','0');
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
INSERT INTO `tbl_services_type` VALUES (55,'Wash & Fold','0','4'),(56,'Dry Cleaning','0','4'),(57,'Steam Press','0','4'),(58,'Wash & Iron','0','4'),(59,'Delicate Hand Wash','0','4'),(60,'Stain Treatment & Spotting','0','4'),(61,'Starching & Polishing','0','4'),(62,'Express 4-Hour Rush','0','4'),(63,'Anti-Bacterial Sanitization','0','4'),(64,'Eco-Friendly Green Clean','0','4'),(65,'Woolen & Cashmere Care','0','4'),(66,'Leather & Suede Restoration','0','4'),(67,'Silk & Velvet Specialty','0','4'),(68,'Bedding & Linen Refresh','0','4'),(69,'Curtain & Drapery Treatment','0','4'),(70,'Shoe & Sneaker Detailing','0','7'),(71,'Dyeing & Color Revive','0','7'),(72,'Minor Alteration & Hemming','0','7'),(73,'store 3 service type 1','0','9');
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
INSERT INTO `tbl_staff_roll` VALUES (1,'read,write','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit','read,write,edit,delete','read,write,edit,delete','read,edit','read,edit','read','read','read,edit','read,edit','read','read,write,edit,delete','12','1','0'),(2,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','2','0'),(3,'read,write','read,edit','read,write,edit','read','read,write','','','','','','','read','','','','','','13','3','1'),(4,'read,write','read,delete','read,write,edit','read','read,write','','','','','','','read','','','','','','15','4','1'),(5,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','5','0'),(6,'read,write','read,edit','read,write,edit','read','read,write','','','','','','','read','','','','','','13','6','1'),(7,'read,write','read,delete','read,write,edit','read','read,write','','','','','','','read','','','','','','15','7','1'),(8,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','8','0'),(9,'read,write','read,edit','read,write,edit','read','read,write','','','','','','','read','','','','','','13','9','1'),(10,'read,write','read,delete','read,write,edit','read','read,write','','','','','','','read','','','','','','15','10','1'),(11,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','11','0'),(12,'read,write','read,edit','read,write,edit','read','read,write','','','','','','','read','','','','','','13','12','1'),(13,'read,write','read,delete','read,write,edit','read','read,write','','','','','','','read','','','','','','15','13','1'),(14,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','14','0'),(15,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','15','0'),(16,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','16','0'),(18,'read,write,edit','read,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','read,write,edit,delete','','read,write,edit,delete','read,write,edit,delete','read,edit','','read','read','read,edit','read,edit','','read,write,edit,delete','13','18','0');
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
INSERT INTO `tbl_store` VALUES (4,'Store 1','default.png','+1-310-555-0167','store1','$2b$10$Cz9.b2lOZEurIQ1lx81iI.RdaUZ.tG7ncsazBj22kts3a5LuD1jzW',15,9.5,'undefined','CA','Los Angeles','Los Angeles','90210','care@royallaundry.com','TAX-90210-4','450 Rodeo Luxury Suites, Beverly Hills','1','0','2026-09-18 11:35:11','13','11'),(7,'Store 2','1790145635533-Gemini_Generated_Image_jq9fzqjq9fzqjq9f-removebg-preview.png','923225126622','store2','$2b$10$AysaI88sodneA5tE5EOM/eWNbUiJOQ5/WPyu96FWsDQv5Z4Jj7PmO',10,5,'Pakistan ','Punjab','Rawalpindi',' Rawalpindi','43000','store2@gmail.com','545468932','None None None ','1','0','2026-09-23 06:40:35','13','16'),(9,'Store 3','1790149463265-1000066546 (1).png','923525432154','store3','$2b$10$8QExTR180LshgA9.ZeKFYeigFo7frcmUqGLYEiL8GIQ4ElB6ciypa',10,5,'Pakistan ','Punjab','Multan',' Multan','45000','store3@gmail.com','54796132','None None None ','1','0','2026-09-23 07:44:23','13','18');
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
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_transections`
--

LOCK TABLES `tbl_transections` WRITE;
/*!40000 ALTER TABLE `tbl_transections` DISABLE KEYS */;
INSERT INTO `tbl_transections` VALUES (61,'7','4','Payment for #ORD0173 (REF-20260822-1000)','INCOME','40',0,4.66,4.66,'2026-08-22 07:00:00'),(62,'8','4','Payment for #ORD0174 (REF-20260823-1001)','INCOME','41',0,29.56,29.56,'2026-08-23 07:00:00'),(63,'8','4','Payment for #ORD0175 (REF-20260824-1002)','INCOME','42',0,53.66,53.66,'2026-08-24 07:00:00'),(64,'8','4','Payment for #ORD0176 (REF-20260825-1003)','INCOME','43',0,7.12,7.12,'2026-08-25 07:00:00'),(65,'7','4','Payment for #ORD0177 (REF-20260827-1004)','INCOME','44',0,65.15,65.15,'2026-08-27 07:00:00'),(66,'8','4','Payment for #ORD0178 (REF-20260828-1005)','INCOME','45',0,30.66,30.66,'2026-08-28 07:00:00'),(67,'8','4','Payment for #ORD0179 (REF-20260829-1006)','INCOME','46',0,27.38,27.38,'2026-08-29 07:00:00'),(68,'7','4','Payment for #ORD0181 (REF-20260831-1008)','INCOME','48',0,62.96,62.96,'2026-08-31 07:00:00'),(69,'8','4','Payment for #ORD0182 (REF-20260902-1009)','INCOME','49',0,2.19,2.19,'2026-09-02 07:00:00'),(70,'8','4','Payment for #ORD0183 (REF-20260903-1010)','INCOME','50',0,20.8,20.8,'2026-09-03 07:00:00'),(71,'8','4','Payment for #ORD0184 (REF-20260904-1011)','INCOME','51',0,61.87,61.87,'2026-09-04 07:00:00'),(72,'7','4','Payment for #ORD0185 (REF-20260905-1012)','INCOME','52',0,27.92,27.92,'2026-09-05 07:00:00'),(73,'8','4','Payment for #ORD0188 (REF-20260909-1015)','INCOME','42',0,10.95,10.95,'2026-09-09 07:00:00'),(74,'7','4','Payment for #ORD0189 (REF-20260910-1016)','INCOME','43',0,108.95,108.95,'2026-09-10 07:00:00'),(75,'8','4','Payment for #ORD0190 (REF-20260911-1017)','INCOME','44',0,62.42,62.42,'2026-09-11 07:00:00'),(76,'8','4','Payment for #ORD0191 (REF-20260912-1018)','INCOME','45',0,40.52,40.52,'2026-09-12 07:00:00'),(77,'8','4','Payment for #ORD0192 (REF-20260914-1019)','INCOME','46',0,79.93,79.93,'2026-09-14 07:00:00'),(78,'7','4','Payment for #ORD0193 (REF-20260915-1020)','INCOME','47',0,33.4,33.4,'2026-09-15 07:00:00'),(79,'8','4','Payment for #ORD0195 (REF-20260917-1022)','INCOME','49',0,51.46,51.46,'2026-09-17 07:00:00'),(80,'8','4','Payment for #ORD0196 (REF-20260918-1023)','INCOME','50',0,100.19,100.19,'2026-09-18 07:00:00'),(82,'10','','New Account Opening','INCOME',NULL,0,50000,50000,'2026-09-23 09:16:39'),(85,'13','9','New Account Opening','INCOME',NULL,0,500000,500000,'2026-09-23 09:27:47'),(86,'14','9','New Account Opening','INCOME',NULL,0,58961300,58961300,'2026-09-23 09:33:35'),(87,'13','9','ouypo biuj  kj hiu','EXPENCE','0',545,0,499455,'2026-09-22 19:00:00'),(88,'15','7','New Account Opening','INCOME',NULL,0,8954650,8954650,'2026-09-23 09:34:49'),(89,'15','7','','EXPENCE','0',5645,0,8949000,'2026-09-23 19:00:00'),(90,'13','9','POS Income #ORD0001','INCOME','57',0,115.5,499570,'2026-09-22 19:00:00'),(91,'13','9','POS Income #ORD0098','INCOME','62',0,105,499675,'2026-09-22 19:00:00');
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

-- Dump completed on 2026-09-23 23:54:33

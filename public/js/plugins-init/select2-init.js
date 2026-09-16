

(function($) {
  "use strict"
  

// $("#single-select, #pos_store_id, #serviceType_tbl .service_type_Row, #add_servie_storelist, #service_type, #to_account, #from_account, #account, #Expence_report_store, #order_report_store, #ragister_stroteUser, #sales_report_store, #tax_report_store, #daily_report_store").select2({
//   placeholder: 'Search for a repository',
// });

  // single select box
  $("#single-select").select2({
    placeholder: 'Search Customer',
  });
 $("#pos_store_id").select2({
    placeholder: 'Search for a repository',
  });

$("#serviceType_tbl .service_type_Row").select2({
    placeholder: 'Search for a repository',
  });

  $("#add_servie_storelist").select2({
    placeholder: 'Search for a repository',
  });

$("#service_type").select2({
    placeholder: 'Search for a repository',
  });

  
//   $("#to_account").select2({
//     placeholder: 'Search for account',
//   });

 
//  $("#from_account").select2({
//     placeholder: 'Search for account',
//   });


 $("#account").select2({
    placeholder: 'Search Account',
  });
  
   $("#Expence_report_store").select2({
    placeholder: 'Search Report',
  });

  $("#order_report_store").select2({
    placeholder: 'Search Report',
  });
  
  $("#ragister_stroteUser").select2({
    placeholder: 'Search for a repository',
  });

$("#sales_report_store").select2({
    placeholder: 'Search Report',
  });
$("#tax_report_store").select2({
    placeholder: 'Search Report',
  });
  
  
  $("#daily_report_store").select2({
    placeholder: 'Search Report',
  });
  
    $("#fromStore").select2({
      placeholder:"Search Source Store",
    })

})(jQuery);
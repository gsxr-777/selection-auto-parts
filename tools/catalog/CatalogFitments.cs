using System;
using System.IO;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;

partial class CatalogExport {
 static string Digest(string value){using(var sha=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
 static bool CompleteFile(string path){return File.Exists(path)&&File.Exists(path+".complete")&&File.ReadAllText(path+".complete").Trim()==new FileInfo(path).Length.ToString(CultureInfo.InvariantCulture);}
 static List<object> Conditions(object article){var information=new List<string>();foreach(var info in Items(Get(article,"LinkageInformations")))information.Add(Text(info,"InformationText"));return new List<object>{Row("general",AttributesFrom(Get(article,"GeneralLinkageAttributes")),"alternatives",Blocks(article),"information",information)};}
 static object ExactArticle(Assembly types,object articles,object suppliers,string brandId,string number){
  foreach(var candidate in Items(Call(articles,"SearchArticle",number,Enum.Parse(types.GetType("TMDVD.DataType.Interface.EArticleDirect"),"ArticleNumber"),(UInt32)10000,Enum.Parse(types.GetType("TMDVD.DataType.Interface.EArticleDirectOrder"),"Default"))))if(Text(Get(candidate,"Supplier"),"ID")==brandId&&Text(candidate,"DataSupplierArticleNumber")==number)return candidate;
  // A common short number can exceed the direct-search result bound. Enumerate only
  // its exact supplier instead of silently omitting that article from the import.
  var supplier=Call(suppliers,"GetSupplier",UInt32.Parse(brandId,CultureInfo.InvariantCulture));
  foreach(var candidate in Items(Call(articles,"GetAllArticles",supplier)))if(Text(candidate,"DataSupplierArticleNumber")==number&&Text(Get(candidate,"Supplier"),"ID")==brandId)return candidate;
  throw new Exception("Exact source article not found "+brandId+":"+number);
 }
 // Categories are resolved against the target vehicle's own tree and source product/supplier pair.
 // Aggregated parent products must not create extra direct category assignments.
 static bool FitmentContains(object tree,object node,string product,string supplier,Dictionary<object,bool> cache){
  bool contains;if(cache.TryGetValue(node,out contains))return contains;
  contains=false;
  foreach(var pair in Items(Call(tree,"GetProductDatasuppliers",node)))if(Text(Get(pair,"Product"),"ID")==product&&Text(Get(pair,"Supplier"),"ID")==supplier){contains=true;break;}
  cache[node]=contains;return contains;
 }
 static void FitmentNodes(object tree,object baseTree,IEnumerable nodes,string parent,string product,string supplier,Dictionary<object,bool> cache,List<object> ancestors,List<object> categories,List<string> direct){
  foreach(var node in nodes){
   if(!FitmentContains(tree,node,product,supplier,cache))continue;
   string id=Text(baseTree,"ID")+":"+Text(node,"ID");var row=Row("entity","category","id",id,"sourceId",Text(node,"ID"),"parentId",parent,"label",Text(node,"Description"));
   var path=new List<object>(ancestors);path.Add(row);bool covered=false;
   foreach(var child in Items(Get(node,"Nodes")))if(FitmentContains(tree,child,product,supplier,cache)){covered=true;break;}
   if(!covered){direct.Add(id);foreach(var category in path)categories.Add(category);}
   FitmentNodes(tree,baseTree,Items(Get(node,"Nodes")),id,product,supplier,cache,path,categories,direct);
  }
 }
 static void ExportFitments(Assembly types,Assembly dal,object config,object master,object links,StreamWriter log){
  if(Text(Get(master,"CurrentValidityParameter"),"CurrentQuarter")!="2/2018")throw new Exception("Unexpected source release");
  string planText=File.ReadAllText(Path.Combine(output,"plan.json")),planHash=Digest(planText);
  var plan=json.Deserialize<Dictionary<string,object>>(planText);
  if(Convert.ToInt32(plan["version"])!=1||Convert.ToString(plan["release"])!="2/2018"||Convert.ToString(plan["country"])!="RUS")throw new Exception("Unsupported fitment plan");
  string manifestPath=Path.Combine(output,"manifest.json");
  if(File.Exists(manifestPath)){var old=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(manifestPath));if(Convert.ToString(old["planHash"])!=planHash)throw new Exception("Fitment plan changed; archive this export directory first");}
  else File.WriteAllText(manifestPath,json.Serialize(Row("version",1,"release","2/2018","country","RUS","locales",new string[]{"en","ru"},"extractedAt",DateTime.UtcNow.ToString("o"),"scope",plan["scope"],"planHash",planHash,"method","GetLinkedItemsV2/GetReverseArticleV2","relation","CurrentArticle")));
  var allowed=new HashSet<string>();foreach(var id in Items(plan["variantIds"]))allowed.Add(Convert.ToString(id));
  var suppliers=Create(dal,"SupplierData",config);AssertInit(suppliers,master);var articles=Create(dal,"ArticleData",config);AssertInit(articles,master,suppliers,links);var tree=Create(dal,"SearchTreeData",config);var linkage=Create(dal,"LinkageData",config);AssertInit(tree,master,suppliers,linkage);AssertInit(linkage,master,suppliers,tree,links,articles);
  var files=new List<string>();int work=0;
  foreach(string locale in new string[]{"en","ru"}){Locale(master,locale);foreach(var value in Items(plan["parts"])){
   var part=(Dictionary<string,object>)value;string partId=Convert.ToString(part["id"]),brandId=Convert.ToString(part["brandId"]),number=Convert.ToString(part["number"]),prefix=Digest(partId).Substring(0,24)+"-"+locale;
   string partComplete=Path.Combine(output,prefix+".done.json");
   if(File.Exists(partComplete)){var done=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(partComplete));foreach(var file in Items(done["files"])){string name=Convert.ToString(file);if(!CompleteFile(Path.Combine(output,name)))throw new Exception("Invalid completed fitment chunk "+name);files.Add(name);}continue;}
   object article=ExactArticle(types,articles,suppliers,brandId,number);
   var sampleAllowed=new HashSet<string>();foreach(var id in Items(part["variantIds"]))sampleAllowed.Add(Convert.ToString(id));
   var candidates=new Dictionary<string,object>();int parentLinks=0,unsupported=0,outside=0,sampleExcluded=0;
   foreach(DictionaryEntry group in (IDictionary)Call(articles,"GetLinkedItemsV2",article))foreach(var reverse in Items(group.Value)){
    string kind=group.Key.ToString()=="PassengerCar"?"car":group.Key.ToString()=="Motorbike"?"motorcycle":null;
    if(kind==null){unsupported++;continue;}if(Text(reverse,"FoundVia")!="CurrentArticle"){parentLinks++;continue;}
    string id=kind+":"+Text(Get(reverse,"Linkitem"),"ID");if(!allowed.Contains(id)){outside++;continue;}if(sampleAllowed.Count>0&&!sampleAllowed.Contains(id)){sampleExcluded++;continue;}candidates[id]=reverse;
   }
   var ids=new List<string>(candidates.Keys);ids.Sort(StringComparer.Ordinal);var partFiles=new List<string>();
   log.WriteLine("FITMENT_PART "+locale+" "+partId+" directTargets="+ids.Count+" parentExcluded="+parentLinks+" unsupported="+unsupported+" outside="+outside+" sampleExcluded="+sampleExcluded);
   for(int offset=0;offset<ids.Count;offset+=50){
    string name=prefix+"-"+(offset/50).ToString("D5",CultureInfo.InvariantCulture)+".jsonl",file=Path.Combine(output,name);partFiles.Add(name);files.Add(name);if(CompleteFile(file))continue;
    using(var writer=new StreamWriter(file+".tmp",false,new System.Text.UTF8Encoding(false))){var written=new HashSet<string>();
     for(int i=offset;i<Math.Min(offset+50,ids.Count);i++){
      string id=ids[i],kind=id.StartsWith("car:")?"PassengerCar":"Motorbike";var reverse=candidates[id];var vehicle=Get(reverse,"Linkitem");
      var result=Generic(linkage,"GetReverseArticleV2",types.GetType("TMDVD.DataType.Interface."+(kind=="PassengerCar"?"IPassengerCar":"IMotorbike")),article,vehicle,Get(reverse,"FoundVia"));int count=0;
      foreach(var linked in Items(Get(result,"Articles"))){
       if(Text(Get(linked,"Supplier"),"ID")!=brandId||Text(linked,"DataSupplierArticleNumber")!=number||Text(Get(linked,"CurrentLinkitem"),"ID")!=Text(vehicle,"ID"))throw new Exception("Unexpected reverse article identity "+partId+" "+id);
       string product=Text(Get(linked,"CurrentProduct"),"ID"),sequence=Text(linked,"SequenceID");if(product==""||sequence=="")throw new Exception("Missing source linkage identity");
       var categories=new List<object>();var direct=new List<string>();
       foreach(var baseTree in Items(Call(tree,"GetSearchTree",Enum.Parse(types.GetType("TMDVD.DataType.Interface.ESearchTreeType"),kind),vehicle)))FitmentNodes(tree,baseTree,Items(Get(baseTree,"Nodes")),null,product,brandId,new Dictionary<object,bool>(),new List<object>(),categories,direct);
       if(direct.Count==0)throw new Exception("No target source category for "+partId+" "+id+" "+product);
       foreach(var category in categories){var row=(Dictionary<string,object>)category;if(written.Add(Convert.ToString(row["id"])))Write(writer,row);}
       foreach(string categoryId in new HashSet<string>(direct)){Write(writer,Row("entity","fitment","partId",partId,"variantId",id,"categoryId",categoryId,"productId",product,"sequenceId",sequence,"foundVia","CurrentArticle","label",Text(linked,"NormalizedDescription"),"attributes",Attributes(linked),"conditions",Conditions(linked)));count++;}
      }
      if(count==0)throw new Exception("Direct reverse target has no exact linkage "+partId+" "+id);work++;log.WriteLine("FITMENT_TARGET "+locale+" "+partId+" "+id+" rows="+count);
     }
    }
    if(File.Exists(file))File.Delete(file);File.Move(file+".tmp",file);File.WriteAllText(file+".complete",new FileInfo(file).Length.ToString(CultureInfo.InvariantCulture));
    if(work>=2000||System.Diagnostics.Process.GetCurrentProcess().PrivateMemorySize64>900L*1048576)throw new ContinueExport();
   }
   File.WriteAllText(partComplete,json.Serialize(Row("partId",partId,"locale",locale,"files",partFiles,"directTargets",ids.Count,"parentExcluded",parentLinks,"unsupported",unsupported,"outside",outside,"sampleExcluded",sampleExcluded)));
  }}
  File.WriteAllText(Path.Combine(output,"export.complete.json"),json.Serialize(Row("planHash",planHash,"files",files)));log.WriteLine("FITMENTS_COMPLETE files="+files.Count);
 }
}

using System;
using System.IO;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;

// Runs inside the already licensed desktop catalog session. No vendor binaries are modified.
class CatalogExport {
 static string program=@"C:\Program Files\TecAlliance\Catalogue\Program";
 static string output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-export";
 static JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=Int32.MaxValue};
 static Dictionary<string,List<object>> oeCache=new Dictionary<string,List<object>>();
 static Dictionary<string,List<object>> crossCache=new Dictionary<string,List<object>>();
 static HashSet<string> completedNodes=new HashSet<string>();
 static HashSet<string> completedQueries=new HashSet<string>();
 static HashSet<string> writtenCategories=new HashSet<string>();
 static int workQueries=0;
 static int localeBase=0;
 static void SaveResume(string locale,string path,int count,HashSet<string> seen){
  File.WriteAllText(path+".checkpoint.json",json.Serialize(Row("length",new FileInfo(path).Length,"count",count,"partIds",new List<string>(seen),"categoryIds",new List<string>(writtenCategories))));
 }
 class ContinueExport:Exception{}
 static bool parentsOnly=false;
 static System.Threading.Mutex exportMutex;
 static object Get(object o,string name){if(o==null)return null;var p=o.GetType().GetProperty(name);return p==null?null:p.GetValue(o,null);}
 static IEnumerable Items(object value){return value as IEnumerable??new object[0];}
 static string Text(object o,string name){return Convert.ToString(Get(o,name),CultureInfo.InvariantCulture);}
 static object Call(object o,string name,params object[] args){foreach(var m in o.GetType().GetMethods())if(m.Name==name&&!m.IsGenericMethod&&m.GetParameters().Length==args.Length)return m.Invoke(o,args);throw new MissingMethodException(name);}
 static Dictionary<string,object> Row(params object[] values){var row=new Dictionary<string,object>();for(int i=0;i<values.Length;i+=2)row[(string)values[i]]=values[i+1];return row;}
 static string Date(object o){return o==null?null:((DateTime)o).ToString("yyyy-MM-dd",CultureInfo.InvariantCulture);}
 static List<object> Attributes(object o){var result=new List<object>();var attrs=Get(o,"Attributes") as IEnumerable;if(attrs!=null)foreach(var a in attrs)result.Add(Row("id",Text(a,"ID"),"title",Text(a,"DisplayTitle"),"value",Text(a,"DisplayValue")));return result;}
 static void Write(StreamWriter writer,object row){writer.WriteLine(json.Serialize(row));}
 static void Locale(object master,string code){bool found=false;foreach(var l in (IEnumerable)Call(master,"GetAllLanguages"))if(Text(l,"IsoCode2")==code){Call(master,"SetCurrentLanguage",l);found=true;break;}if(!found)throw new Exception("Source locale missing: "+code);}
 static object Create(Assembly dal,string name,object config){return Activator.CreateInstance(dal.GetType("TMDVD.DAL.BDF."+name),new object[]{config});}
 static void AssertInit(object o,params object[] args){if(!Convert.ToBoolean(Call(o,"Initialize",args)))throw new Exception("Initialization rejected "+o.GetType().Name);}
 static object Generic(object o,string name,Type type,params object[] args){foreach(var m in o.GetType().GetMethods())if(m.Name==name&&m.IsGenericMethod&&m.GetParameters().Length==args.Length)return m.MakeGenericMethod(type).Invoke(o,args);throw new MissingMethodException(name);}
 static object FindNode(IEnumerable nodes,string id){foreach(var node in nodes){if(Text(node,"ID")==id)return node;var match=FindNode(Items(Get(node,"Nodes")),id);if(match!=null)return match;}return null;}
 static string PairId(object pair){return Text(Get(pair,"Product"),"ID")+":"+Text(Get(pair,"Supplier"),"ID");}
 static string QueryId(string node,List<object> pairs){var names=new List<string>();foreach(var p in pairs)names.Add(PairId(p));using(var sha=System.Security.Cryptography.SHA256.Create())return node+"|"+BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(String.Join(";",names)))).Replace("-","");}
 static int PrepareResume(string locale,string path,HashSet<string> seen){
  completedNodes.Clear();completedQueries.Clear();writtenCategories.Clear();
  string done=Path.Combine(output,"completed-"+locale+".txt"),queries=Path.Combine(output,"queries-"+locale+".txt");if(File.Exists(done))foreach(string id in File.ReadAllLines(done))completedNodes.Add(id);if(File.Exists(queries))foreach(string id in File.ReadAllLines(queries))completedQueries.Add(id);
  if(!File.Exists(path))return 0;int count=0;string clean=path+".clean.tmp";
  if(File.Exists(path+".checkpoint.json")){
   var checkpoint=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(path+".checkpoint.json"));
   if(Convert.ToInt64(checkpoint["length"])==new FileInfo(path).Length){foreach(var id in Items(checkpoint["partIds"]))seen.Add(Convert.ToString(id));foreach(var id in Items(checkpoint["categoryIds"]))writtenCategories.Add(Convert.ToString(id));return Convert.ToInt32(checkpoint["count"]);}
  }
  using(var reader=new StreamReader(path,System.Text.Encoding.UTF8,true,1048576))using(var writer=new StreamWriter(clean,false,new System.Text.UTF8Encoding(false),1048576)){
   while(!reader.EndOfStream){string line=reader.ReadLine();Dictionary<string,object> row;try{row=json.Deserialize<Dictionary<string,object>>(line);}catch{if(reader.EndOfStream)break;throw;}
    bool keep=false;if(Convert.ToString(row["entity"])=="category")keep=writtenCategories.Add(Convert.ToString(row["id"]));
    else if(completedNodes.Contains(Convert.ToString(row["categoryId"]))||(row.ContainsKey("_query")&&completedQueries.Contains(Convert.ToString(row["_query"])))){keep=true;count++;seen.Add(Convert.ToString(row["id"]));}
    if(keep)writer.WriteLine(line);
   }
  }
  File.Copy(path,path+".previous",true);File.Delete(path);File.Move(clean,path);SaveResume(locale,path,count,seen);GC.Collect();return count;
 }
 static void CheckCoverage(object tree,IEnumerable nodes,StreamWriter log){foreach(var node in nodes){var children=Get(node,"Nodes") as IList;if(children!=null&&children.Count>0){var covered=new HashSet<string>();foreach(var child in children)foreach(var pair in Items(Call(tree,"GetProductDatasuppliers",child)))covered.Add(PairId(pair));int missing=0;foreach(var pair in Items(Call(tree,"GetProductDatasuppliers",node)))if(!covered.Contains(PairId(pair)))missing++;if(missing>0)log.WriteLine("PARENT_ONLY "+Text(node,"ID")+" "+Text(node,"Description")+" pairs="+missing);CheckCoverage(tree,children,log);}}}
 static void Coverage(Assembly types,Assembly dal,object config,object master,object links,StreamWriter log){Locale(master,"en");var focus=Generic(links,"SearchTypeByTecdocID",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),(UInt32)18953);var suppliers=Create(dal,"SupplierData",config);AssertInit(suppliers,master);var article=Create(dal,"ArticleData",config);AssertInit(article,master,suppliers,links);var tree=Create(dal,"SearchTreeData",config);var linkage=Create(dal,"LinkageData",config);AssertInit(tree,master,suppliers,linkage);AssertInit(linkage,master,suppliers,tree,links,article);foreach(var t in Items(Call(tree,"GetSearchTree",Enum.Parse(types.GetType("TMDVD.DataType.Interface.ESearchTreeType"),"PassengerCar"),focus)))CheckCoverage(tree,Items(Get(t,"Nodes")),log);log.WriteLine("COVERAGE_COMPLETE");}
 static void Benchmark(Assembly types,Assembly dal,object config,object master,object links,StreamWriter log){
  Locale(master,"en");var focus=Generic(links,"SearchTypeByTecdocID",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),(UInt32)18953);
  var suppliers=Create(dal,"SupplierData",config);AssertInit(suppliers,master);var articles=Create(dal,"ArticleData",config);AssertInit(articles,master,suppliers,links);var tree=Create(dal,"SearchTreeData",config);var linkage=Create(dal,"LinkageData",config);AssertInit(tree,master,suppliers,linkage);AssertInit(linkage,master,suppliers,tree,links,articles);
  var watch=System.Diagnostics.Stopwatch.StartNew();object node=null;
  foreach(var t in (IEnumerable)Call(tree,"GetSearchTree",Enum.Parse(types.GetType("TMDVD.DataType.Interface.ESearchTreeType"),"PassengerCar"),focus)){node=FindNode(Items(Get(t,"Nodes")),"101658");if(node!=null)break;}
  log.WriteLine("treeMs="+watch.ElapsedMilliseconds);watch.Restart();var legacyList=Generic(linkage,"GetArticleList",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),focus,node,Call(tree,"GetProductDatasuppliers",node));log.WriteLine("legacyListMs="+watch.ElapsedMilliseconds+" count="+((IList)legacyList).Count);foreach(var a in Items(legacyList)){log.WriteLine("LEGACY_TYPE "+a.GetType()+" currentVehicle="+Text(Get(a,"CurrentLinkitem"),"ID"));break;}watch.Restart();var result=Generic(linkage,"GetArticleListV2",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),focus,node,Call(tree,"GetProductDatasuppliers",node),false);log.WriteLine("listMs="+watch.ElapsedMilliseconds+" count="+((IList)Get(result,"Articles")).Count);
  foreach(var method in linkage.GetType().GetMethods())if(method.Name.Contains("ArticleList")||method.Name.Contains("LinkageDetails")){log.WriteLine("METHOD "+method);foreach(var parameter in method.GetParameters())log.WriteLine("PARAM "+parameter.Name+" "+parameter.ParameterType);}
  int count=0;foreach(var article in Items(Get(result,"Articles"))){if(count==0){log.WriteLine("ARTICLE_TYPE "+article.GetType());foreach(var property in article.GetType().GetProperties())log.WriteLine("PROPERTY "+property.Name+" "+property.PropertyType);foreach(var method in article.GetType().GetMethods())if(!method.IsSpecialName)log.WriteLine("ARTICLE_METHOD "+method);}watch.Restart();var oe=Call(articles,"GetArticleOENumbers",article);log.WriteLine("oeMs="+watch.ElapsedMilliseconds);watch.Restart();Get(article,"ReplaceNumbers");Get(article,"NewNumbers");log.WriteLine("crossMs="+watch.ElapsedMilliseconds);watch.Restart();var details=Generic(linkage,"GetLinkageDetailsV1",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),article,focus,Get(article,"CurrentProduct"));log.WriteLine("detailMs="+watch.ElapsedMilliseconds);watch.Restart();Attributes(article);log.WriteLine("attrMs="+watch.ElapsedMilliseconds);if(++count==1)break;}
 }
 static void Parts(Assembly types,Assembly dal,object config,object master,object links,StreamWriter log){
  var focus=Generic(links,"SearchTypeByTecdocID",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),(UInt32)18953);
  var suppliers=Create(dal,"SupplierData",config);AssertInit(suppliers,master);
  var articles=Create(dal,"ArticleData",config);AssertInit(articles,master,suppliers,links);
  var tree=Create(dal,"SearchTreeData",config);var linkage=Create(dal,"LinkageData",config);
  AssertInit(tree,master,suppliers,linkage);AssertInit(linkage,master,suppliers,tree,links,articles);
  Type enumType=types.GetType("TMDVD.DataType.Interface.ESearchTreeType");foreach(var name in Enum.GetNames(enumType))log.WriteLine("TREE_ENUM "+name+"="+Enum.Parse(enumType,name));
  Locale(master,"en");
  foreach(var area in (IEnumerable)Call(tree,"GetAvailableSearchAreas"))log.WriteLine("AREA "+area);
  var seenParts=new HashSet<string>();int nodes=0,fitments=0;
  foreach(string locale in new string[]{"en","ru"}){
   Locale(master,locale);
   oeCache.Clear();crossCache.Clear();
   localeBase=fitments;
   string rowsPath=Path.Combine(output,"parts-"+locale+".jsonl");fitments+=PrepareResume(locale,rowsPath,seenParts);
   string completePath=rowsPath+".complete";
   if(File.Exists(completePath)&&File.ReadAllText(completePath)==new FileInfo(rowsPath).Length.ToString(CultureInfo.InvariantCulture)){log.WriteLine("SKIP_COMPLETE_LOCALE "+locale);continue;}
   using(var writer=new StreamWriter(rowsPath,true,new System.Text.UTF8Encoding(false),1048576)){
    // Ask the reader for the area matching the precise source vehicle kind.
    object area=null;foreach(string name in Enum.GetNames(enumType))if(name.ToLowerInvariant().Contains("passenger")){area=Enum.Parse(enumType,name);break;}
    if(area==null)throw new Exception("Passenger car search area not identified");
    foreach(var baseTree in (IEnumerable)Call(tree,"GetSearchTree",area,focus)){
     log.WriteLine("TREE "+Get(baseTree,"ID")+" "+Get(baseTree,"Description"));
     Walk(types,tree,linkage,articles,focus,baseTree,Get(baseTree,"Nodes") as IEnumerable,null,locale,writer,log,seenParts,ref nodes,ref fitments);
    }
   }
   SaveResume(locale,rowsPath,fitments-localeBase,seenParts);
   File.WriteAllText(completePath,new FileInfo(rowsPath).Length.ToString(CultureInfo.InvariantCulture));
   log.WriteLine("PARTS_LOCALE_COMPLETE "+locale+" nodes="+nodes+" fitments="+fitments+" uniqueParts="+seenParts.Count);
  }
  log.WriteLine("PARTS_COMPLETE");
 }
 static void Walk(Assembly types,object tree,object linkage,object articleDal,object focus,object baseTree,IEnumerable children,string parent,string locale,StreamWriter writer,StreamWriter log,HashSet<string> seen,ref int nodes,ref int fitments){
  if(children==null)return;
  foreach(var node in children){
   string id=Text(baseTree,"ID")+":"+Text(node,"ID");nodes++;
   if(writtenCategories.Add(id))Write(writer,Row("entity","category","id",id,"sourceId",Text(node,"ID"),"parentId",parent,"label",Text(node,"Description"),"state",Text(node,"ValidState")));
   // Each node can contain products itself as well as child nodes.
   var descendants=Get(node,"Nodes") as IList;
   object supplierList=null;
   if(parentsOnly){
    if(descendants!=null&&descendants.Count>0){var covered=new HashSet<string>();foreach(var child in descendants)foreach(var pair in Items(Call(tree,"GetProductDatasuppliers",child)))covered.Add(PairId(pair));var sourcePairs=Call(tree,"GetProductDatasuppliers",node);var remaining=(IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(types.GetType("TMDVD.DataType.Interface.IProductDatasupplier")));foreach(var pair in Items(sourcePairs))if(!covered.Contains(PairId(pair)))remaining.Add(pair);supplierList=remaining;}
   }else supplierList=descendants!=null&&descendants.Count>0?null:Call(tree,"GetProductDatasuppliers",node);
   if(!completedNodes.Contains(id)&&supplierList!=null&&((IList)supplierList).Count>0){
    var ordered=new List<object>();foreach(var pair in (IEnumerable)supplierList)ordered.Add(pair);ordered.Sort(delegate(object a,object b){return StringComparer.Ordinal.Compare(PairId(a),PairId(b));});
    for(int offset=0;offset<ordered.Count;offset+=10){
    var chunk=ordered.GetRange(offset,Math.Min(10,ordered.Count-offset));string queryId=QueryId(id,chunk);if(completedQueries.Contains(queryId))continue;
    var subset=(IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(types.GetType("TMDVD.DataType.Interface.IProductDatasupplier")));foreach(var pair in chunk)subset.Add(pair);
    var result=Generic(linkage,"GetArticleListV2",types.GetType("TMDVD.DataType.Interface.IPassengerCar"),focus,node,subset,false);
    foreach(var article in (IEnumerable)Get(result,"Articles")){
     object supplier=Get(article,"Supplier");string partId=Text(supplier,"ID")+":"+Text(article,"DataSupplierArticleNumber");seen.Add(partId);fitments++;
     bool includeReferences=!oeCache.ContainsKey(partId);
     List<object> oe;if(!oeCache.TryGetValue(partId,out oe)){oe=new List<object>();foreach(var reference in (IEnumerable)Call(articleDal,"GetArticleOENumbers",article))oe.Add(Row("manufacturerId",Text(Get(reference,"Manufacturer"),"ID"),"manufacturer",Text(Get(reference,"Manufacturer"),"Description"),"number",Text(reference,"OENbr"),"additive",Get(reference,"IsAdditive"),"information",Text(reference,"ReferenceInformation")));oeCache.Add(partId,oe);}
     List<object> crosses;if(!crossCache.TryGetValue(partId,out crosses)){crosses=new List<object>();foreach(string property in new string[]{"ReplaceNumbers","NewNumbers"}){var references=Get(article,property) as IEnumerable;if(references!=null)foreach(var reference in references){var target=Get(reference,"Article");crosses.Add(Row("type",property=="ReplaceNumbers"?"replaces":"replaced_by","number",Text(reference,property=="ReplaceNumbers"?"ReplaceNbr":"NewNbr"),"brand",Text(Get(target,"Supplier"),"Description"),"sourceId",target==null?null:Text(Get(target,"Supplier"),"ID")+":"+Text(target,"DataSupplierArticleNumber")));}}crossCache.Add(partId,crosses);}
     if(Text(Get(article,"CurrentLinkitem"),"ID")!="18953")throw new Exception("Unexpected source vehicle linkage: "+partId);
     var conditions=new List<object>();object product=Get(article,"CurrentProduct");
     // LinkageArticle already contains this exact source sequence's complete conditions.
     // A per-article GetLinkageDetailsV1 call repeats an expensive scan of the source.
     foreach(var detail in new object[]{article}){
      var general=new List<object>();foreach(var a in Items(Get(detail,"GeneralLinkageAttributes")))general.Add(Row("id",Text(a,"ID"),"title",Text(a,"DisplayTitle"),"value",Text(a,"DisplayValue")));
      var blocks=new List<object>();foreach(var b in Items(Get(detail,"LinkageBlocks")))blocks.Add(Attributes(b));
      var information=new List<string>();foreach(var info in Items(Get(detail,"LinkageInformations")))information.Add(Text(info,"InformationText"));
      conditions.Add(Row("general",general,"alternatives",blocks,"information",information));
     }
     var exportedRow=Row("entity","part","id",partId,"brandId",Text(supplier,"ID"),"brand",Text(supplier,"Description"),"number",Text(article,"DataSupplierArticleNumber"),"label",Text(article,"NormalizedDescription"),"categoryId",id,"variantId","car:18953","sequenceId",Text(article,"SequenceID"),"productId",Text(product,"ID"),"attributes",Attributes(article),"conditions",conditions,"oe",includeReferences?oe:new List<object>(),"crosses",includeReferences?crosses:new List<object>(),"_query",queryId,"_references",includeReferences);Write(writer,exportedRow);
    }
    writer.Flush();File.AppendAllText(Path.Combine(output,"queries-"+locale+".txt"),queryId+Environment.NewLine);completedQueries.Add(queryId);workQueries++;
    long managed=GC.GetTotalMemory(false),memory=System.Diagnostics.Process.GetCurrentProcess().PrivateMemorySize64;
    // Serialization creates large temporary strings. Measure retained memory before
    // restarting the reader, otherwise transient allocations trigger needless reloads.
    if(managed>650L*1048576||memory>1000L*1048576){managed=GC.GetTotalMemory(true);memory=System.Diagnostics.Process.GetCurrentProcess().PrivateMemorySize64;}
    log.WriteLine("QUERY "+locale+" "+id+" offset="+offset+" fitments="+fitments+" managedMB="+(managed/1048576)+" privateMB="+(memory/1048576));
    if(workQueries>=30||managed>650L*1048576||memory>1000L*1048576){SaveResume(locale,Path.Combine(output,"parts-"+locale+".jsonl"),fitments-localeBase,seen);throw new ContinueExport();}
    }
   }
   if(nodes%25==0)log.WriteLine("NODE_PROGRESS "+locale+" nodes="+nodes+" fitments="+fitments);
   writer.Flush();log.WriteLine("NODE "+locale+" "+id+" "+Text(node,"Description")+" fitments="+fitments);
   if(completedNodes.Add(id))File.AppendAllText(Path.Combine(output,"completed-"+locale+".txt"),id+Environment.NewLine);
   Walk(types,tree,linkage,articleDal,focus,baseTree,descendants,id,locale,writer,log,seen,ref nodes,ref fitments);
  }
 }
 static int Main(string[] args){
  if(args.Length>0&&args[0]=="--benchmark")output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-benchmark";
  if(args.Length>0&&args[0]=="--metadata")output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-metadata";
  if(args.Length>0&&args[0]=="--coverage")output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-coverage";
  if(args.Length>0&&args[0]=="--parent-parts"){parentsOnly=true;output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-parent-export";}
  if(args.Length>0&&args[0]=="--reference-manufacturers")output=@"\\VBOXSVR\1\777\laravel\selection-auto-parts\.cache\catalog-reference-export";
  exportMutex=new System.Threading.Mutex(false,"selection-auto-parts-"+Path.GetFileName(output));
  if(!exportMutex.WaitOne(0,false))return 2;
  Directory.CreateDirectory(output);
  AppDomain.CurrentDomain.AssemblyResolve+=delegate(object sender,ResolveEventArgs e){string p=Path.Combine(program,new AssemblyName(e.Name).Name+".dll");return File.Exists(p)?Assembly.LoadFrom(p):null;};
  Environment.CurrentDirectory=program;
  using(var log=new StreamWriter(Path.Combine(output,"progress.txt"))){log.AutoFlush=true;try{
   var types=Assembly.LoadFrom(Path.Combine(program,"TMDVD.DataType.dll"));var dal=Assembly.LoadFrom(Path.Combine(program,"TMDVD.DAL.BDF.dll"));
   if(args.Length>0&&args[0]=="--metadata"){
    foreach(var type in dal.GetExportedTypes())if(type.Name.Contains("Article")||type.Name.Contains("Linkage")){log.WriteLine("TYPE "+type.FullName);foreach(var p in type.GetProperties())log.WriteLine("PROPERTY "+p.Name+" "+p.PropertyType);foreach(var m in type.GetMethods())if(m.Name.Contains("ArticleList")||m.Name.Contains("LinkageDetails")){log.WriteLine("METHOD "+m);foreach(var p in m.GetParameters())log.WriteLine("PARAM "+p.Name+" "+p.ParameterType);}}
    return 0;
   }
   using(var metadata=new StreamWriter(Path.Combine(output,"reader-metadata.txt"))){foreach(var type in dal.GetExportedTypes())if(type.Name.EndsWith("Data")){metadata.WriteLine(type.FullName);foreach(var c in type.GetConstructors())metadata.WriteLine(c);}}
   var config=Activator.CreateInstance(types.GetType("TMDVD.DataType.Common.BDFConfiguration"));config.GetType().GetProperty("DataPaths").SetValue(config,new List<string>{@"C:\Program Files\TecAlliance\Catalogue\Data",@"C:\Program Files\TecAlliance\Catalogue\Media"},null);
   var master=Activator.CreateInstance(dal.GetType("TMDVD.DAL.BDF.MasterData"),new object[]{config,Activator.CreateInstance(types.GetType("TMDVD.DataType.Common.PDFDownloadConfiguration"))});AssertInit(master);
   if(!Convert.ToBoolean(Get(master,"IsSecurityOk")))throw new Exception("Reader security check rejected");
   foreach(var country in (IEnumerable)Call(master,"GetAllCountries"))if(Text(country,"IsoCode3")=="RUS"){Call(master,"SetDataCountry",country);Call(master,"SetLinkitemCountry",country);break;}
   var links=Create(dal,"LinkitemData",config);AssertInit(links,master);
   if(args.Length>0&&args[0]=="--reference-manufacturers"){
    if(Text(Get(master,"CurrentValidityParameter"),"CurrentQuarter")!="2/2018")throw new Exception("Unexpected source release");
    File.WriteAllText(Path.Combine(output,"manifest.json"),json.Serialize(Row("version",1,"release","2/2018","country","RUS","locales",new string[]{"en","ru"},"extractedAt",DateTime.UtcNow.ToString("o"))));
    foreach(string locale in new string[]{"en","ru"}){Locale(master,locale);int count=0;using(var writer=new StreamWriter(Path.Combine(output,"manufacturers-"+locale+".jsonl"))){foreach(var manufacturer in Items(Call(links,"GetAllManufacturers"))){Write(writer,Row("id",Text(manufacturer,"ID"),"label",Text(manufacturer,"Description"),"comparison",Get(manufacturer,"IsVGL")));count++;}}log.WriteLine("REFERENCE_MANUFACTURERS "+locale+" count="+count);}
    foreach(string locale in new string[]{"en","ru"}){string file=Path.Combine(output,"manufacturers-"+locale+".jsonl");File.WriteAllText(file+".complete",new FileInfo(file).Length.ToString(CultureInfo.InvariantCulture));}
    log.WriteLine("REFERENCE_MANUFACTURERS_COMPLETE");return 0;
   }
   if(args.Length>0&&args[0]=="--coverage"){Coverage(types,dal,config,master,links,log);return 0;}
   if(args.Length>0&&args[0]=="--benchmark"){Benchmark(types,dal,config,master,links,log);Call(master,"Dispose");return 0;}
   if(args.Length>0&&(args[0]=="--parts"||args[0]=="--parent-parts")){if(Text(Get(master,"CurrentValidityParameter"),"CurrentQuarter")!="2/2018")throw new Exception("Unexpected source release");Parts(types,dal,config,master,links,log);return 0;}
   File.WriteAllText(Path.Combine(output,"manifest.json"),json.Serialize(Row("version",1,"release",Text(Get(master,"CurrentValidityParameter"),"CurrentQuarter"),"country","RUS","locales",new string[]{"en","ru"},"extractedAt",DateTime.UtcNow.ToString("o"))));
   var focus=new List<object>();
   foreach(string locale in new string[]{"en","ru"}){
    Locale(master,locale);int modelCount=0,typeCount=0;var seenMakes=new HashSet<string>();var seenModels=new HashSet<string>();var seenTypes=new HashSet<string>();
    using(var writer=new StreamWriter(Path.Combine(output,"vehicles-"+locale+".jsonl"))){
     foreach(var make in (IEnumerable)Call(links,"GetAllManufacturers"))foreach(var model in (IEnumerable)Call(links,"GetModels",make))foreach(string kind in new string[]{"car","motorcycle"}){
      foreach(var variant in (IEnumerable)Call(links,kind=="car"?"GetPassengerCars":"GetMotorbikes",model)){
       string makeId=Text(make,"ID"),modelId=kind+":"+Text(model,"ID"),variantId=kind+":"+Text(variant,"ID");
       if(seenMakes.Add(makeId))Write(writer,Row("entity","make","id",makeId,"label",Text(make,"Description")));
       var interval=Get(model,"ConstructionInterval");
       if(seenModels.Add(modelId)){modelCount++;Write(writer,Row("entity","model","id",modelId,"sourceId",Text(model,"ID"),"makeId",makeId,"kind",kind,"label",Text(model,"Description"),"from",Date(Get(interval,"From")),"to",Date(Get(interval,"To"))));}
       if(seenTypes.Add(variantId)){typeCount++;interval=Get(variant,"ConstructionInterval");var attrs=Attributes(variant);Write(writer,Row("entity","variant","id",variantId,"sourceId",Text(variant,"ID"),"modelId",modelId,"label",Text(variant,"Description"),"from",Date(Get(interval,"From")),"to",Date(Get(interval,"To")),"attributes",attrs));
        if(locale=="en"&&Text(make,"Description")=="FORD"&&Text(model,"Description").Contains("FOCUS II")&&Text(model,"Description").Contains("DB_")&&Text(variant,"Description")=="1.6"){focus.Add(variant);log.WriteLine("FOCUS "+variantId+" "+Text(model,"Description")+" "+Text(variant,"Description")+" "+json.Serialize(attrs)+" "+Date(Get(interval,"From"))+".."+Date(Get(interval,"To")));}
       }
      }
     }
    }
    log.WriteLine("VEHICLES "+locale+" makes="+seenMakes.Count+" models="+modelCount+" variants="+typeCount);
   }
   log.WriteLine("VEHICLES_COMPLETE");
   Call(master,"Dispose");return 0;
  }catch(ContinueExport){log.WriteLine("CONTINUE_FROM_CHECKPOINT");return 10;}catch(Exception e){log.WriteLine("ERROR "+e);return 1;}}
 }
}
